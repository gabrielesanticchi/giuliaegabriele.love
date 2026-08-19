import { randomBytes, randomUUID } from "node:crypto";

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
          targetId: settingKey
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
          .where(eq(auditLogs.targetId, settingKey))
      ).toHaveLength(1);
    });
  }
);
