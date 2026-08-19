import { randomBytes, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type WeddingDatabase } from "@/db";
import { gifts, giftIntents } from "@/db/schema";
import {
  cancelIntent,
  contributeToGift,
  reserveGift,
  TransactionError,
  verifyIntent
} from "@/db/transactions";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration(
  "gift transactions (requires TEST_DATABASE_URL; skipped without a real PostgreSQL database)",
  () => {
    let sql: postgres.Sql;
    let db: WeddingDatabase;
    const giftIds: string[] = [];

    beforeAll(async () => {
      sql = postgres(databaseUrl!, { max: 8 });
      db = createDatabase(sql);
      await migrate(db, { migrationsFolder: "drizzle" });
    });

    afterAll(async () => {
      if (!sql) return;
      if (giftIds.length > 0) {
        await db.delete(gifts).where(inArray(gifts.id, giftIds));
      }
      await sql.end();
    });

    async function createGift(priceCents = 10_000): Promise<string> {
      const id = randomUUID();
      giftIds.push(id);
      await db.insert(gifts).values({
        id,
        publicReference: `G-${id}`,
        title: "Regalo integrazione",
        priceCents
      });
      return id;
    }

    function tokenHash(): string {
      return randomBytes(32).toString("hex");
    }

    it("returns one intent when the same idempotency key is submitted concurrently", async () => {
      const giftId = await createGift();
      const input = {
        giftId,
        idempotencyKey: randomUUID(),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer" as const,
        guestTokenHash: tokenHash(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      const results = await Promise.all([
        reserveGift(db, input),
        reserveGift(db, { ...input, publicReference: `I-${randomUUID()}` })
      ]);

      expect(results[0].id).toBe(results[1].id);
      const rows = await db
        .select()
        .from(giftIntents)
        .where(eq(giftIntents.idempotencyKey, input.idempotencyKey));
      expect(rows).toHaveLength(1);
    });

    it("maps competing full-gift reservations to gift_unavailable", async () => {
      const giftId = await createGift();
      const attempts = ["A", "B"].map((suffix) =>
        reserveGift(db, {
          giftId,
          idempotencyKey: randomUUID(),
          publicReference: `I-${suffix}-${randomUUID()}`,
          method: "bank_transfer",
          guestTokenHash: tokenHash(),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        })
      );

      const results = await Promise.allSettled(attempts);
      expect(
        results.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      );
      expect(rejected?.reason).toBeInstanceOf(TransactionError);
      expect((rejected?.reason as TransactionError).code).toBe(
        "gift_unavailable"
      );
      expect((rejected?.reason as TransactionError).httpStatus).toBe(409);
    });

    it("serializes concurrent contributions so their sum never exceeds the price", async () => {
      const giftId = await createGift(10_000);
      const attempts = [6_000, 6_000].map((amountCents, index) =>
        contributeToGift(db, {
          giftId,
          amountCents,
          idempotencyKey: randomUUID(),
          publicReference: `C-${index}-${randomUUID()}`,
          method: "bank_transfer",
          guestTokenHash: tokenHash(),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        })
      );

      const results = await Promise.allSettled(attempts);
      expect(
        results.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      );
      expect((rejected?.reason as TransactionError).code).toBe(
        "amount_unavailable"
      );
    });

    it("verifies idempotently while separating received and applied amounts", async () => {
      const giftId = await createGift(10_000);
      const first = await contributeToGift(db, {
        giftId,
        amountCents: 8_000,
        idempotencyKey: randomUUID(),
        publicReference: `C-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      await verifyIntent(db, {
        intentId: first.id,
        receivedAmountCents: 8_000
      });
      const second = await contributeToGift(db, {
        giftId,
        amountCents: 2_000,
        idempotencyKey: randomUUID(),
        publicReference: `C-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });

      const verified = await verifyIntent(db, {
        intentId: second.id,
        receivedAmountCents: 3_000
      });
      const repeated = await verifyIntent(db, {
        intentId: second.id,
        receivedAmountCents: 9_000
      });

      expect(verified.receivedAmountCents).toBe(3_000);
      expect(verified.appliedAmountCents).toBe(2_000);
      expect(repeated.receivedAmountCents).toBe(3_000);
      expect(repeated.appliedAmountCents).toBe(2_000);
      const gift = await db.select().from(gifts).where(eq(gifts.id, giftId));
      expect(gift[0]?.completed).toBe(true);
    });

    it("cancels pending commitments but rejects guest cancellation after payment declaration", async () => {
      const giftId = await createGift();
      const cancellable = await reserveGift(db, {
        giftId,
        idempotencyKey: randomUUID(),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      const cancelled = await cancelIntent(db, {
        intentId: cancellable.id,
        actor: "guest"
      });
      expect(cancelled.status).toBe("cancelled");

      const declared = await reserveGift(db, {
        giftId,
        idempotencyKey: randomUUID(),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      await db
        .update(giftIntents)
        .set({ paymentDeclaredAt: new Date() })
        .where(eq(giftIntents.id, declared.id));

      await expect(
        cancelIntent(db, { intentId: declared.id, actor: "guest" })
      ).rejects.toMatchObject({
        code: "payment_already_declared",
        httpStatus: 409
      });
    });
  }
);
