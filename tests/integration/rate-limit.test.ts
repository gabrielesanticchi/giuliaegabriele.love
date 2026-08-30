import { randomBytes, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type WeddingDatabase } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { authenticateAdmin } from "@/lib/auth/repository";
import { hashEmail, hashFingerprint } from "@/lib/security/hashing";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration(
  "PostgreSQL rate limiter (requires TEST_DATABASE_URL; skipped without a real database)",
  () => {
    let sql: postgres.Sql;
    let db: WeddingDatabase;
    const fingerprints: string[] = [];

    beforeAll(async () => {
      sql = postgres(databaseUrl!, { max: 12, prepare: false });
      db = createDatabase(sql);
      await migrate(db, { migrationsFolder: "drizzle" });
    });

    afterAll(async () => {
      if (!sql) return;
      if (fingerprints.length > 0) {
        await db
          .delete(rateLimitBuckets)
          .where(inArray(rateLimitBuckets.fingerprintHash, fingerprints));
      }
      await sql.end();
    });

    function fingerprint(): string {
      const value = randomBytes(32).toString("hex");
      fingerprints.push(value);
      return value;
    }

    it("allows the boundary count and blocks the first excess request", async () => {
      const fingerprintHash = fingerprint();
      const bucketKey = `boundary-${randomUUID()}`;
      const now = new Date("2026-08-19T10:00:00.000Z");

      const decisions = [];
      for (let request = 0; request < 4; request += 1) {
        decisions.push(
          await consumeRateLimit(db, {
            fingerprintHash,
            bucketKey,
            limit: 3,
            windowMs: 60_000,
            now
          })
        );
      }

      expect(decisions.map(({ allowed }) => allowed)).toEqual([
        true,
        true,
        true,
        false
      ]);
      expect(decisions.map(({ remaining }) => remaining)).toEqual([2, 1, 0, 0]);
    });

    it("atomically retains every concurrent increment", async () => {
      const fingerprintHash = fingerprint();
      const bucketKey = `concurrent-${randomUUID()}`;
      const now = new Date("2026-08-19T10:00:00.000Z");

      await Promise.all(
        Array.from({ length: 20 }, () =>
          consumeRateLimit(db, {
            fingerprintHash,
            bucketKey,
            limit: 100,
            windowMs: 60_000,
            now
          })
        )
      );

      const rows = await db
        .select({ count: rateLimitBuckets.count })
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.fingerprintHash, fingerprintHash));
      expect(rows).toEqual([{ count: 20 }]);
    });

    it("claims both login buckets before credentials and blocks attempt seven", async () => {
      const pepper = randomBytes(32).toString("hex");
      process.env.AUTH_HMAC_PEPPER = pepper;
      process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString("base64");
      const email = `missing-${randomUUID()}@example.test`;
      const identity = `integration-ip-${randomUUID()}`;
      const ipHash = hashFingerprint(identity, pepper);
      const emailHash = hashEmail(email, pepper);
      fingerprints.push(ipHash, emailHash);

      const results = await Promise.all(
        Array.from({ length: 7 }, () =>
          authenticateAdmin({
            email,
            password: "invalid",
            clientIdentity: identity,
            db
          })
        )
      );
      expect(results).toEqual(Array.from({ length: 7 }, () => null));
      const buckets = await db
        .select()
        .from(rateLimitBuckets)
        .where(inArray(rateLimitBuckets.fingerprintHash, [ipHash, emailHash]));
      expect(buckets).toHaveLength(2);
      expect(buckets.map((bucket) => bucket.count).sort()).toEqual([7, 7]);
    });

    it("starts a fresh counter after the fixed window expires", async () => {
      const fingerprintHash = fingerprint();
      const bucketKey = `rollover-${randomUUID()}`;
      const start = new Date("2026-08-19T10:00:00.000Z");
      await consumeRateLimit(db, {
        fingerprintHash,
        bucketKey,
        limit: 1,
        windowMs: 60_000,
        now: start
      });

      const rollover = await consumeRateLimit(db, {
        fingerprintHash,
        bucketKey,
        limit: 1,
        windowMs: 60_000,
        now: new Date("2026-08-19T10:01:00.001Z")
      });

      expect(rollover).toEqual({
        allowed: true,
        remaining: 0,
        retryAfterSeconds: 0
      });
      const rows = await db
        .select({ count: rateLimitBuckets.count })
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.fingerprintHash, fingerprintHash));
      expect(rows).toEqual([{ count: 1 }]);
    });
  }
);
