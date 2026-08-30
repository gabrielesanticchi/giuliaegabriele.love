import { createHash, randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type WeddingDatabase } from "@/db";
import {
  adminActionReceipts,
  adminUsers,
  auditLogs,
  siteSettings
} from "@/db/schema";
import { runAdminIdempotentTransaction } from "@/lib/admin/idempotency";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration(
  "admin receipt/effect/audit transaction (requires TEST_DATABASE_URL; skipped without a real database)",
  () => {
    let client: postgres.Sql;
    let db: WeddingDatabase;
    const actorId = randomUUID();
    const settingKey = `test-${randomUUID()}`;
    const auditTargetId = randomUUID();

    beforeAll(async () => {
      client = postgres(databaseUrl!, { max: 4 });
      db = createDatabase(client);
      await migrate(db, { migrationsFolder: "drizzle" });
      await db.insert(adminUsers).values({
        id: actorId,
        emailHash: randomBytes(32).toString("hex"),
        emailEncrypted: "test",
        passwordHash: "test",
        role: "owner"
      });
    });

    afterAll(async () => {
      if (!client) return;
      await db.delete(siteSettings).where(eq(siteSettings.key, settingKey));
      await db.delete(adminUsers).where(eq(adminUsers.id, actorId));
      await client.end();
    });

    it("rolls receipt, effect and audit back together and replays a committed result", async () => {
      const idempotencyKey = randomUUID();
      const input = {
        actorAdminId: actorId,
        action: "test.atomic",
        entityId: settingKey,
        idempotencyKey,
        payload: { value: 1 },
        db
      };
      await expect(
        runAdminIdempotentTransaction({
          ...input,
          effect: async (tx) => {
            await tx
              .insert(siteSettings)
              .values({ key: settingKey, value: { value: 1 } });
            throw new Error("rollback");
          }
        })
      ).rejects.toThrow("rollback");
      expect(
        await db
          .select()
          .from(adminActionReceipts)
          .where(eq(adminActionReceipts.entityId, settingKey))
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(siteSettings)
          .where(eq(siteSettings.key, settingKey))
      ).toHaveLength(0);

      const committed = await runAdminIdempotentTransaction({
        ...input,
        effect: async (tx) => {
          await tx
            .insert(siteSettings)
            .values({ key: settingKey, value: { value: 1 } });
          return { settingKey };
        },
        audit: () => ({
          action: "test.atomic",
          targetType: "site_setting",
          targetId: auditTargetId
        })
      });
      const replay = await runAdminIdempotentTransaction({
        ...input,
        effect: async () => {
          throw new Error("must not run");
        }
      });
      expect(committed.replayed).toBe(false);
      expect(replay).toEqual({ result: { settingKey }, replayed: true });
      expect(
        await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.targetId, auditTargetId))
      ).toHaveLength(1);
    });

    it("rejects reuse with a different payload", async () => {
      const key = randomUUID();
      const base = {
        actorAdminId: actorId,
        action: "test.mismatch",
        entityId: randomUUID(),
        idempotencyKey: key,
        db
      };
      await runAdminIdempotentTransaction({
        ...base,
        payload: { value: 1 },
        effect: async () => ({ ok: true })
      });
      await expect(
        runAdminIdempotentTransaction({
          ...base,
          payload: { value: 2 },
          effect: async () => ({ ok: true })
        })
      ).rejects.toThrow("payload diverso");
    });

    it("reclaims only the exact stale pending receipt", async () => {
      const entityId = randomUUID();
      const key = randomUUID();
      await db.insert(adminActionReceipts).values({
        actorAdminId: actorId,
        action: "test.stale",
        entityId,
        idempotencyKey: key,
        payloadHash: createHash("sha256").update('{"value":1}').digest("hex"),
        status: "pending",
        result: {},
        createdAt: new Date(Date.now() - 600_000)
      });
      const result = await runAdminIdempotentTransaction({
        actorAdminId: actorId,
        action: "test.stale",
        entityId,
        idempotencyKey: key,
        payload: { value: 1 },
        db,
        effect: async () => ({ recovered: true })
      });
      expect(result).toEqual({ result: { recovered: true }, replayed: false });
    });

    it("runs one effect for concurrent claims", async () => {
      const entityId = randomUUID();
      const key = randomUUID();
      let effects = 0;
      const claim = () =>
        runAdminIdempotentTransaction({
          actorAdminId: actorId,
          action: "test.concurrent",
          entityId,
          idempotencyKey: key,
          payload: {},
          db,
          effect: async () => ({ sequence: ++effects })
        });
      const results = await Promise.all([claim(), claim()]);
      expect(effects).toBe(1);
      expect(results.map((item) => item.result)).toEqual([
        { sequence: 1 },
        { sequence: 1 }
      ]);
    });
  }
);
