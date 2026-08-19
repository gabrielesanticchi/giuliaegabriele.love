import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase, type WeddingDatabase } from "@/db";
import { adminUsers, rateLimitBuckets } from "@/db/schema";
import {
  consumeRateLimit,
  getRateLimitDecision
} from "@/lib/security/rate-limit";
import { hashEmail, hashFingerprint } from "@/lib/security/hashing";

import type { AdminPrincipal, AdminRole } from "./authorization";
import { authSecrets, isTotpRequired } from "./environment";
import { verifyAdminPassword } from "./password";
import { verifyRecoveryCode, verifyTotpCode } from "./totp";

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
    isActive: row.disabledAt === null,
    totpPending: isTotpRequired() && !row.totpEnabled
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

async function consumeRecoveryCode(
  db: WeddingDatabase,
  row: AdminRow,
  code: string,
  recoveryPepper: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from ${adminUsers} where id = ${row.id} for update`
    );
    const current = await tx
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, row.id))
      .limit(1);
    if (!current[0]) return false;
    const result = verifyRecoveryCode({
      code,
      recoveryCodeHashes: current[0].recoveryCodeHashes,
      recoveryPepper
    });
    if (!result.valid || !result.hashes) return false;
    await tx
      .update(adminUsers)
      .set({ recoveryCodeHashes: result.hashes, updatedAt: new Date() })
      .where(eq(adminUsers.id, row.id));
    return true;
  });
}

export async function authenticateAdmin(input: {
  email: string;
  password: string;
  code?: string;
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
  const existingBuckets = await Promise.all(
    bucketPairs.map(([hash, key]) =>
      db
        .select()
        .from(rateLimitBuckets)
        .where(
          and(
            eq(rateLimitBuckets.fingerprintHash, hash),
            eq(rateLimitBuckets.bucketKey, key)
          )
        )
        .limit(1)
    )
  );
  const now = new Date();
  if (
    existingBuckets.some(
      (rows) =>
        rows[0] &&
        !getRateLimitDecision({
          count: rows[0].count,
          limit: 6,
          now,
          expiresAt: rows[0].expiresAt
        }).allowed
    )
  )
    return null;

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
    await Promise.all(
      bucketPairs.map(([hash, key]) =>
        consumeRateLimit(db, {
          fingerprintHash: hash,
          bucketKey: key,
          limit: 6,
          windowMs: 15 * 60_000
        })
      )
    );
    return null;
  }

  if (row.totpEnabled) {
    if (!input.code) {
      await Promise.all(
        bucketPairs.map(([hash, key]) =>
          consumeRateLimit(db, {
            fingerprintHash: hash,
            bucketKey: key,
            limit: 6,
            windowMs: 15 * 60_000
          })
        )
      );
      return null;
    }
    const validTotp = row.totpSecretEncrypted
      ? await verifyTotpCode({
          code: input.code,
          secretEncrypted: row.totpSecretEncrypted,
          encryptionKey: secrets.encryptionKey
        })
      : false;
    if (
      !validTotp &&
      !(await consumeRecoveryCode(db, row, input.code, secrets.recoveryPepper))
    ) {
      await Promise.all(
        bucketPairs.map(([hash, key]) =>
          consumeRateLimit(db, {
            fingerprintHash: hash,
            bucketKey: key,
            limit: 6,
            windowMs: 15 * 60_000
          })
        )
      );
      return null;
    }
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
