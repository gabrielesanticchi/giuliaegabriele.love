import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { generate as generateTotpToken } from "otplib";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type WeddingDatabase } from "@/db";
import { adminUsers, auditLogs } from "@/db/schema";
import {
  beginTotpEnrollmentAction,
  completeTotpEnrollmentAction,
  restartTotpEnrollmentAction
} from "@/actions/admin/totp";
import { withAdminAuthDependencies } from "@/actions/admin/shared";
import type { AdminPrincipal } from "@/lib/auth/authorization";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration(
  "recoverable TOTP enrollment (requires TEST_DATABASE_URL; skipped without a real database)",
  () => {
    let client: postgres.Sql;
    let db: WeddingDatabase;
    let encryptionKey: string;
    let adminId: string;

    const principal = (): AdminPrincipal => ({
      id: adminId,
      role: "owner",
      sessionVersion: 1,
      isActive: true,
      totpPending: true
    });

    const run = <T>(action: () => Promise<T>): Promise<T> =>
      withAdminAuthDependencies(
        { getPrincipal: async () => principal() },
        action
      );

    async function completionCodeFromPending(): Promise<string> {
      const rows = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId))
        .limit(1);
      const secret = decryptSecret(
        rows[0]!.pendingTotpSecretEncrypted!,
        encryptionKey
      );
      const token = await generateTotpToken({ secret });
      return typeof token === "string"
        ? token
        : (token as { token: string }).token;
    }

    beforeAll(async () => {
      encryptionKey = randomBytes(32).toString("base64");
      process.env.DATABASE_URL = databaseUrl!;
      process.env.AUTH_HMAC_PEPPER = randomBytes(32).toString("hex");
      process.env.AUTH_ENCRYPTION_KEY = encryptionKey;
      process.env.AUTH_RECOVERY_PEPPER = randomBytes(32).toString("hex");
      client = postgres(databaseUrl!, { max: 4, prepare: false });
      db = createDatabase(client);
      await migrate(db, { migrationsFolder: "drizzle" });
    });

    afterAll(async () => {
      if (!client) return;
      await client.end();
    });

    beforeEach(async () => {
      adminId = randomUUID();
      await db.delete(auditLogs);
      await db.insert(adminUsers).values({
        id: adminId,
        emailHash: randomBytes(32).toString("hex"),
        emailEncrypted: encryptSecret("admin@example.test", encryptionKey),
        passwordHash: "test",
        role: "owner"
      });
    });

    it("restarts a pending enrollment after a lost response and completes", async () => {
      const first = await run(beginTotpEnrollmentAction);
      expect(first.ok).toBe(true);
      const [afterBegin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId));
      const beginSecret = afterBegin.pendingTotpSecretEncrypted;

      // The QR/recovery response is "lost": recover via an authenticated restart.
      const restart = await run(restartTotpEnrollmentAction);
      expect(restart.ok).toBe(true);
      expect(restart.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(restart.recoveryCodes).toHaveLength(8);

      const [afterRestart] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId));
      expect(afterRestart.pendingTotpSecretEncrypted).not.toBe(beginSecret);
      expect(afterRestart.totpEnabled).toBe(false);

      const code = await completionCodeFromPending();
      const form = new FormData();
      form.set("code", code);
      const completed = await run(() =>
        completeTotpEnrollmentAction({ ok: false, message: "" }, form)
      );
      expect(completed.ok).toBe(true);

      const [enabled] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId));
      expect(enabled.totpEnabled).toBe(true);
      expect(enabled.pendingTotpSecretEncrypted).toBeNull();
      expect(enabled.recoveryCodeHashes.length).toBe(8);
    });

    it("never rewrites the active credentials of an enabled account", async () => {
      const activeSecret = encryptSecret("ACTIVESECRET234567", encryptionKey);
      const activeHashes = ["hash-a", "hash-b"];
      await db
        .update(adminUsers)
        .set({
          totpEnabled: true,
          totpSecretEncrypted: activeSecret,
          recoveryCodeHashes: activeHashes
        })
        .where(eq(adminUsers.id, adminId));

      const result = await run(restartTotpEnrollmentAction);
      expect(result.ok).toBe(false);

      const [row] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId));
      expect(row.totpSecretEncrypted).toBe(activeSecret);
      expect(row.recoveryCodeHashes).toEqual(activeHashes);
      expect(row.pendingTotpSecretEncrypted).toBeNull();
    });

    it("serializes concurrent restarts and stays completable", async () => {
      const results = await Promise.all([
        run(restartTotpEnrollmentAction),
        run(restartTotpEnrollmentAction)
      ]);
      expect(results.every((result) => result.ok)).toBe(true);

      const audits = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.targetId, adminId));
      expect(audits).toHaveLength(2);

      const code = await completionCodeFromPending();
      const form = new FormData();
      form.set("code", code);
      const completed = await run(() =>
        completeTotpEnrollmentAction({ ok: false, message: "" }, form)
      );
      expect(completed.ok).toBe(true);
    });
  }
);
