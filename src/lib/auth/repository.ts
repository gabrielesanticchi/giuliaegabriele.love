import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, type WeddingDatabase } from "@/db";
import { adminUsers, rateLimitBuckets } from "@/db/schema";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { hashEmail, hashFingerprint } from "@/lib/security/hashing";

import type { AdminPrincipal, AdminRole } from "./authorization";
import { authSecrets } from "./environment";
import { verifyAdminPassword } from "./password";

type AdminRow = typeof adminUsers.$inferSelect;

function roleOf(value: string): AdminRole | null {
  return value === "owner" || value === "editor" ? value : null;
}

function principalFromRow(row: AdminRow): AdminPrincipal | null {
  const role = roleOf(row.role);
  if (!role) return null;
  return {
    id: row.id,
    role,
    sessionVersion: row.sessionVersion,
    isActive: row.disabledAt === null
  };
}

export async function loadAdminPrincipal(
  adminId: string,
  db: WeddingDatabase = getDatabase()
): Promise<AdminPrincipal | null> {
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1);
  return rows[0] ? principalFromRow(rows[0]) : null;
}

export async function authenticateAdmin(input: {
  email: string;
  password: string;
  clientIdentity: string;
  db?: WeddingDatabase;
}): Promise<AdminPrincipal | null> {
  const db = input.db ?? getDatabase();
  const secrets = authSecrets();
  const fingerprintHash = hashFingerprint(
    input.clientIdentity,
    secrets.hmacPepper
  );
  const emailHash = hashEmail(input.email, secrets.hmacPepper);
  const bucketPairs = [
    [fingerprintHash, "admin-login:ip"],
    [emailHash, "admin-login:email"]
  ] as const;
  // Claim both buckets atomically before doing any expensive credential work.
  // Attempts 1..6 are allowed; the seventh is rejected even under concurrency.
  const claims = await Promise.all(
    bucketPairs.map(([hash, key]) =>
      consumeRateLimit(db, {
        fingerprintHash: hash,
        bucketKey: key,
        limit: 6,
        windowMs: 15 * 60_000
      })
    )
  );
  if (claims.some((claim) => !claim.allowed)) return null;

  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.emailHash, emailHash))
    .limit(1);
  const row = rows[0];
  if (
    !row ||
    row.disabledAt ||
    !(await verifyAdminPassword(input.password, row.passwordHash))
  ) {
    return null;
  }

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, row.id));
  await Promise.all(
    bucketPairs.map(([hash, key]) =>
      db
        .delete(rateLimitBuckets)
        .where(
          and(
            eq(rateLimitBuckets.fingerprintHash, hash),
            eq(rateLimitBuckets.bucketKey, key)
          )
        )
    )
  );
  return principalFromRow(row);
}
