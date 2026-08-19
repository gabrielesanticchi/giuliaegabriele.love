import { randomBytes, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type WeddingDatabase } from "@/db";
import { gifts, giftIntents, giftLocks } from "@/db/schema";
import {
  cancelIntent,
  contributeToGift,
  declareIntentPayment,
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
        published: true,
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
        amountCents: 10_000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: tokenHash(),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer" as const,
        guestTokenHash: tokenHash(),
        guestDetailsEncrypted: "encrypted-guest-details",
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
          amountCents: 10_000,
          idempotencyKey: randomUUID(),
          requestFingerprintHash: tokenHash(),
          publicReference: `I-${suffix}-${randomUUID()}`,
          method: "bank_transfer",
          guestTokenHash: tokenHash(),
          guestDetailsEncrypted: "encrypted-guest-details",
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
          requestFingerprintHash: tokenHash(),
          publicReference: `C-${index}-${randomUUID()}`,
          method: "bank_transfer",
          guestTokenHash: tokenHash(),
          guestDetailsEncrypted: "encrypted-guest-details",
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
        amountCents: 6_000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: tokenHash(),
        publicReference: `C-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        guestDetailsEncrypted: "encrypted-guest-details",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      const second = await contributeToGift(db, {
        giftId,
        amountCents: 4_000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: tokenHash(),
        publicReference: `C-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        guestDetailsEncrypted: "encrypted-guest-details",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });

      const firstVerified = await verifyIntent(db, {
        intentId: first.id,
        receivedAmountCents: 10_000
      });

      const verified = await verifyIntent(db, {
        intentId: second.id,
        receivedAmountCents: 4_000
      });
      const repeated = await verifyIntent(db, {
        intentId: second.id,
        receivedAmountCents: 9_000
      });

      expect(firstVerified.receivedAmountCents).toBe(10_000);
      expect(firstVerified.appliedAmountCents).toBe(6_000);
      expect(verified.receivedAmountCents).toBe(4_000);
      expect(verified.appliedAmountCents).toBe(4_000);
      expect(repeated.receivedAmountCents).toBe(4_000);
      expect(repeated.appliedAmountCents).toBe(4_000);
      const gift = await db.select().from(gifts).where(eq(gifts.id, giftId));
      expect(gift[0]?.completed).toBe(true);
    });

    it("cancels pending commitments but rejects guest cancellation after payment declaration", async () => {
      const giftId = await createGift();
      const cancellable = await reserveGift(db, {
        giftId,
        amountCents: 10_000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: tokenHash(),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        guestDetailsEncrypted: "encrypted-guest-details",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      const cancelled = await cancelIntent(db, {
        intentId: cancellable.id,
        actor: "guest",
        idempotencyKey: "cancel-action-key-0001"
      });
      const cancelReplay = await cancelIntent(db, {
        intentId: cancellable.id,
        actor: "guest",
        idempotencyKey: "cancel-action-key-0001"
      });
      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.guestCancelIdempotencyKey).toBe(
        "cancel-action-key-0001"
      );
      expect(cancelled.replayed).toBe(false);
      expect(cancelReplay.replayed).toBe(true);

      const declared = await reserveGift(db, {
        giftId,
        amountCents: 10_000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: tokenHash(),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        guestDetailsEncrypted: "encrypted-guest-details",
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

    it("declares payment atomically and idempotently without changing pending status", async () => {
      const giftId = await createGift();
      const intent = await reserveGift(db, {
        giftId,
        amountCents: 10_000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: tokenHash(),
        publicReference: `I-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        guestDetailsEncrypted: "encrypted-guest-details",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });

      const declared = await declareIntentPayment(db, {
        intentId: intent.id,
        idempotencyKey: "complete-action-key-0001"
      });
      const repeated = await declareIntentPayment(db, {
        intentId: intent.id,
        idempotencyKey: "complete-action-key-0001"
      });

      expect(declared.status).toBe("pending");
      expect(declared.paymentDeclaredAt).not.toBeNull();
      expect(declared.guestCompleteIdempotencyKey).toBe(
        "complete-action-key-0001"
      );
      expect(declared.replayed).toBe(false);
      expect(repeated.paymentDeclaredAt).toEqual(declared.paymentDeclaredAt);
      expect(repeated.replayed).toBe(true);
    });

    it.each(["pending", "verified"] as const)(
      "rejects a full-gift reservation with a %s contribution",
      async (contributionStatus) => {
        const giftId = await createGift();
        const contribution = await contributeToGift(db, {
          giftId,
          amountCents: 2_000,
          idempotencyKey: randomUUID(),
          requestFingerprintHash: tokenHash(),
          publicReference: `C-${randomUUID()}`,
          method: "bank_transfer",
          guestTokenHash: tokenHash(),
          guestDetailsEncrypted: "encrypted-guest-details",
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        });
        if (contributionStatus === "verified") {
          await verifyIntent(db, {
            intentId: contribution.id,
            receivedAmountCents: 2_000
          });
        }

        await expect(
          reserveGift(db, {
            giftId,
            amountCents: 10_000,
            idempotencyKey: randomUUID(),
            requestFingerprintHash: tokenHash(),
            publicReference: `I-${randomUUID()}`,
            method: "bank_transfer",
            guestTokenHash: tokenHash(),
            guestDetailsEncrypted: "encrypted-guest-details",
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
          })
        ).rejects.toMatchObject({ code: "gift_unavailable", httpStatus: 409 });
      }
    );

    it("rejects a changed request that reuses an idempotency key", async () => {
      const giftId = await createGift();
      const idempotencyKey = randomUUID();
      await contributeToGift(db, {
        giftId,
        amountCents: 2_000,
        idempotencyKey,
        requestFingerprintHash: tokenHash(),
        publicReference: `C-${randomUUID()}`,
        method: "bank_transfer",
        guestTokenHash: tokenHash(),
        guestDetailsEncrypted: "encrypted-guest-details",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });

      await expect(
        contributeToGift(db, {
          giftId,
          amountCents: 3_000,
          idempotencyKey,
          requestFingerprintHash: tokenHash(),
          publicReference: `C-${randomUUID()}`,
          method: "bank_transfer",
          guestTokenHash: tokenHash(),
          guestDetailsEncrypted: "encrypted-guest-details",
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        })
      ).rejects.toMatchObject({ code: "duplicate_request", httpStatus: 409 });
    });

    it.each([
      ["reserveGift", reserveGift, 10_000],
      ["contributeToGift", contributeToGift, 3_000]
    ] as const)(
      "%s rolls back the intent when beforeCommit rejects",
      async (_name, mutation, amountCents) => {
        const giftId = await createGift();
        const idempotencyKey = randomUUID();
        const input = {
          giftId,
          amountCents,
          idempotencyKey,
          requestFingerprintHash: tokenHash(),
          publicReference: `I-${randomUUID()}`,
          method: "bank_transfer" as const,
          guestTokenHash: tokenHash(),
          guestDetailsEncrypted: "encrypted-guest-details",
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        };

        await expect(
          mutation(db, input, {
            beforeCommit: async () => {
              throw new Error("banking configuration invalid");
            }
          })
        ).rejects.toThrow("banking configuration invalid");

        const intents = await db
          .select()
          .from(giftIntents)
          .where(eq(giftIntents.idempotencyKey, idempotencyKey));
        const locks = await db
          .select()
          .from(giftLocks)
          .where(eq(giftLocks.giftId, giftId));
        expect(intents).toHaveLength(0);
        expect(locks).toHaveLength(0);
      }
    );
  }
);
