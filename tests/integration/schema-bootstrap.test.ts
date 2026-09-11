import { readdir, readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
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

      const migrationsDirectory = new URL("../../drizzle/", import.meta.url);
      const migrationFiles = (await readdir(migrationsDirectory))
        .filter((name) => /^\d{4}_.+\.sql$/.test(name))
        .sort();
      for (const file of migrationFiles) {
        const migration = await readFile(
          new URL(file, migrationsDirectory),
          "utf8"
        );
        for (const original of migration.split("--> statement-breakpoint")) {
          const statement = original
            .trim()
            .replaceAll('"public".', `"${schemaName}".`);
          if (statement) await bootstrapSql.unsafe(statement);
        }
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

    it("creates request security columns and index after all migrations", async () => {
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
      const registryColumns = await adminSql<
        Array<{ column_name: string; is_nullable: "YES" | "NO" }>
      >`
        select column_name, is_nullable
        from information_schema.columns
        where table_schema = ${schemaName}
          and table_name = 'gift_intents'
          and column_name = 'gift_id'
      `;
      const registryConstraints = await adminSql<
        Array<{ constraint_name: string }>
      >`
        select constraint_name
        from information_schema.table_constraints
        where table_schema = ${schemaName}
          and table_name = 'gift_intents'
          and constraint_name in (
            'gift_intents_full_gift_requires_gift',
            'gift_intents_contribution_has_no_gift'
          )
        order by constraint_name
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
      expect(registryColumns).toEqual([
        { column_name: "gift_id", is_nullable: "YES" }
      ]);
      expect(registryConstraints).toEqual([
        { constraint_name: "gift_intents_contribution_has_no_gift" },
        { constraint_name: "gift_intents_full_gift_requires_gift" }
      ]);
    });

    it("uses cents and direct product fields in the final gift schema", async () => {
      const tables = await adminSql<Array<{ table_name: string }>>`
        select table_name
        from information_schema.tables
        where table_schema = ${schemaName}
          and table_name in ('media_assets', 'story_moments')
        order by table_name
      `;
      const giftColumns = await adminSql<Array<{ column_name: string }>>`
        select column_name
        from information_schema.columns
        where table_schema = ${schemaName}
          and table_name = 'gifts'
          and column_name in (
            'image_path',
            'media_asset_id',
            'price_cents',
            'price_euros',
            'product_url',
            'progress_mode'
          )
        order by column_name
      `;
      const intentColumns = await adminSql<Array<{ column_name: string }>>`
        select column_name
        from information_schema.columns
        where table_schema = ${schemaName}
          and table_name = 'gift_intents'
          and column_name in ('amount_cents', 'amount_euros')
        order by column_name
      `;

      expect(tables).toEqual([]);
      expect(giftColumns).toEqual([
        { column_name: "image_path" },
        { column_name: "price_cents" },
        { column_name: "product_url" }
      ]);
      expect(intentColumns).toEqual([{ column_name: "amount_cents" }]);
    });

    it.each([
      { label: "0002", includesOriginal0003: false },
      { label: "the original 0003", includesOriginal0003: true }
    ])(
      "upgrades a database already migrated through $label",
      async ({ includesOriginal0003 }) => {
        const suffix = randomUUID().replaceAll("-", "");
        const upgradeSchema = `upgrade_${suffix}`;
        const migrationsSchema = `migrations_${suffix}`;
        await adminSql.unsafe(`create schema "${upgradeSchema}"`);
        const upgradeSql = postgres(databaseUrl!, {
          max: 1,
          connection: { search_path: upgradeSchema }
        });

        try {
          const migrationsDirectory = new URL(
            "../../drizzle/",
            import.meta.url
          );
          const appliedFiles = [
            "0000_thick_bishop.sql",
            "0001_abnormal_mastermind.sql",
            "0002_euro_amounts.sql"
          ];
          if (includesOriginal0003) {
            appliedFiles.push("0003_drop_schedule_dresscode.sql");
          }
          for (const file of appliedFiles) {
            const migration = await readFile(
              new URL(file, migrationsDirectory),
              "utf8"
            );
            for (const original of migration.split(
              "--> statement-breakpoint"
            )) {
              const statement = original
                .trim()
                .replaceAll('"public".', `"${upgradeSchema}".`);
              if (statement) await upgradeSql.unsafe(statement);
            }
          }
          await adminSql.unsafe(`create schema "${migrationsSchema}"`);
          await adminSql.unsafe(`
          create table "${migrationsSchema}"."__drizzle_migrations" (
            id serial primary key,
            hash text not null,
            created_at bigint
          )
        `);
          await adminSql.unsafe(`
          insert into "${migrationsSchema}"."__drizzle_migrations"
            (hash, created_at) values ('through-0002', 1788900000000)
        `);
          if (includesOriginal0003) {
            await adminSql.unsafe(`
            insert into "${migrationsSchema}"."__drizzle_migrations"
              (hash, created_at) values ('original-0003', 1788560085370)
          `);
          }

          await migrate(createDatabase(upgradeSql), {
            migrationsFolder: "drizzle",
            migrationsSchema
          });

          const obsolete = await adminSql<Array<{ table_name: string }>>`
          select table_name
          from information_schema.tables
          where table_schema = ${upgradeSchema}
            and table_name in (
              'dress_code_colors',
              'schedule_items',
              'media_assets',
              'story_moments'
            )
        `;
          expect(obsolete).toEqual([]);
        } finally {
          await upgradeSql.end();
          await adminSql.unsafe(`drop schema "${upgradeSchema}" cascade`);
          await adminSql.unsafe(`drop schema "${migrationsSchema}" cascade`);
        }
      }
    );

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
