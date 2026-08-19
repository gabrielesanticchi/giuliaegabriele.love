import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type WeddingDatabase } from "@/db";
import { gifts, giftIntents } from "@/db/schema";
import { reserveGift } from "@/db/transactions";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration(
  "initial schema bootstrap (requires TEST_DATABASE_URL; skipped without a real database)",
  () => {
    const schemaName = `bootstrap_${randomUUID().replaceAll("-", "")}`;
    let adminSql: postgres.Sql;
    let bootstrapSql: postgres.Sql;
    let db: WeddingDatabase;

    beforeAll(async () => {
      adminSql = postgres(databaseUrl!, { max: 1 });
      await adminSql.unsafe(`create schema "${schemaName}"`);
      bootstrapSql = postgres(databaseUrl!, {
        max: 1,
        connection: { search_path: schemaName }
      });

      const migration = await readFile(
        new URL("../../drizzle/0000_thick_bishop.sql", import.meta.url),
        "utf8"
      );
      for (const original of migration.split("--> statement-breakpoint")) {
        const statement = original
          .trim()
          .replaceAll('"public".', `"${schemaName}".`);
        if (statement) await bootstrapSql.unsafe(statement);
      }
      db = createDatabase(bootstrapSql);
    });

    afterAll(async () => {
      if (bootstrapSql) await bootstrapSql.end();
      if (adminSql) {
        await adminSql.unsafe(`drop schema if exists "${schemaName}" cascade`);
        await adminSql.end();
      }
    });

    it("creates request security columns and index from migration 0000", async () => {
      const columns = await adminSql<
        Array<{ column_name: string; is_nullable: "YES" | "NO" }>
      >`
        select column_name, is_nullable
        from information_schema.columns
        where table_schema = ${schemaName}
          and table_name = 'gift_intents'
          and column_name in (
            'request_fingerprint_hash',
            'guest_details_encrypted',
            'guest_complete_idempotency_key',
            'guest_cancel_idempotency_key'
          )
        order by column_name
      `;
      const indexes = await adminSql<Array<{ indexname: string }>>`
        select indexname
        from pg_indexes
        where schemaname = ${schemaName}
          and tablename = 'gift_intents'
          and indexname = 'gift_intents_request_fingerprint_idx'
      `;

      expect(columns).toEqual([
        { column_name: "guest_cancel_idempotency_key", is_nullable: "YES" },
        { column_name: "guest_complete_idempotency_key", is_nullable: "YES" },
        { column_name: "guest_details_encrypted", is_nullable: "NO" },
        { column_name: "request_fingerprint_hash", is_nullable: "NO" }
      ]);
      expect(indexes).toEqual([
        { indexname: "gift_intents_request_fingerprint_idx" }
      ]);
    });

    it("supports an exact idempotent retry immediately after bootstrap", async () => {
      const giftId = randomUUID();
      await db.insert(gifts).values({
        id: giftId,
        publicReference: `G-${giftId}`,
        title: "Regalo bootstrap",
        published: true,
        priceCents: 10_000
      });
      const input = {
        giftId,
        amountCents: 10_000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: randomBytes(32).toString("hex"),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer" as const,
        guestTokenHash: randomBytes(32).toString("hex"),
        guestDetailsEncrypted: "encrypted-guest-details",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      const first = await reserveGift(db, input);
      const retry = await reserveGift(db, {
        ...input,
        publicReference: `I-${randomUUID()}`
      });

      expect(retry.id).toBe(first.id);
      const rows = await db
        .select()
        .from(giftIntents)
        .where(eq(giftIntents.idempotencyKey, input.idempotencyKey));
      expect(rows).toHaveLength(1);
    });
  }
);
