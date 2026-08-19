import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { WeddingDatabase } from "@/db";
import { auditLogs, giftIntents, giftLocks, gifts } from "@/db/schema";

import { mapExhaustedSerializationFailure, TransactionError } from "./errors";
import {
  assertCancellationAllowed,
  assertGiftReservationAvailable,
  assertIdempotentRequestMatches,
  assertPaymentDeclarationAllowed,
  getVerificationAmounts,
  type IntentRequestSemantics
} from "./policies";

type Transaction = Parameters<Parameters<WeddingDatabase["transaction"]>[0]>[0];
type GiftIntent = typeof giftIntents.$inferSelect;
type GiftMethod = GiftIntent["method"];

type NewIntentInput = {
  giftId: string;
  idempotencyKey: string;
  publicReference: string;
  method: GiftMethod;
  amountCents: number;
  requestFingerprintHash: string;
  guestTokenHash: string;
  guestDetailsEncrypted: string;
  guestEmailHash?: string;
  fingerprintHash?: string;
  expiresAt: Date;
};

type PostgresError = Error & { code?: string; constraint_name?: string };

function postgresError(error: unknown): PostgresError | undefined {
  if (error instanceof Error) return error as PostgresError;
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return postgresError(error)?.code === "23505";
}

function constraintName(error: unknown): string {
  return postgresError(error)?.constraint_name ?? "";
}

async function runSerializable<T>(
  db: WeddingDatabase,
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.transaction(callback, { isolationLevel: "serializable" });
    } catch (error) {
      if (postgresError(error)?.code !== "40001") throw error;
      if (attempt === 2) throw mapExhaustedSerializationFailure(error);
    }
  }
  throw new Error("Transazione non raggiungibile");
}

async function findIdempotentIntent(
  db: WeddingDatabase,
  idempotencyKey: string
): Promise<GiftIntent | undefined> {
  const rows = await db
    .select()
    .from(giftIntents)
    .where(eq(giftIntents.idempotencyKey, idempotencyKey))
    .limit(1);
  return rows[0];
}

async function lockAndReadGift(tx: Transaction, giftId: string) {
  await tx.execute(
    sql`select id from ${gifts} where id = ${giftId} for update`
  );
  const rows = await tx
    .select()
    .from(gifts)
    .where(eq(gifts.id, giftId))
    .limit(1);
  return rows[0];
}

async function recoverIdempotency(
  db: WeddingDatabase,
  error: unknown,
  idempotencyKey: string
): Promise<GiftIntent | undefined> {
  if (isUniqueViolation(error)) {
    return findIdempotentIntent(db, idempotencyKey);
  }
  return undefined;
}

function intentSemantics(intent: GiftIntent): IntentRequestSemantics {
  return {
    giftId: intent.giftId,
    kind: intent.kind,
    method: intent.method,
    amountCents: intent.amountCents,
    requestFingerprintHash: intent.requestFingerprintHash
  };
}

function requestSemantics(
  input: NewIntentInput,
  kind: IntentRequestSemantics["kind"]
): IntentRequestSemantics {
  return {
    giftId: input.giftId,
    kind,
    method: input.method,
    amountCents: input.amountCents,
    requestFingerprintHash: input.requestFingerprintHash
  };
}

function resolveIdempotentIntent(
  intent: GiftIntent,
  requested: IntentRequestSemantics
): GiftIntent {
  assertIdempotentRequestMatches(intentSemantics(intent), requested);
  return intent;
}

export async function reserveGift(
  db: WeddingDatabase,
  input: NewIntentInput
): Promise<GiftIntent> {
  const requested = requestSemantics(input, "full_gift");
  try {
    return await runSerializable(db, async (tx) => {
      const idempotent = await tx
        .select()
        .from(giftIntents)
        .where(eq(giftIntents.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (idempotent[0]) {
        return resolveIdempotentIntent(idempotent[0], requested);
      }

      const gift = await lockAndReadGift(tx, input.giftId);
      if (!gift || gift.completed || input.amountCents !== gift.priceCents) {
        throw new TransactionError("gift_unavailable");
      }

      const contributions = await tx
        .select({
          status: giftIntents.status,
          expiresAt: giftIntents.expiresAt,
          amountCents: giftIntents.amountCents,
          appliedAmountCents: giftIntents.appliedAmountCents
        })
        .from(giftIntents)
        .where(
          and(
            eq(giftIntents.giftId, gift.id),
            eq(giftIntents.kind, "contribution")
          )
        );
      assertGiftReservationAvailable({ now: new Date(), contributions });

      const inserted = await tx
        .insert(giftIntents)
        .values({
          ...input,
          kind: "full_gift",
          status: "pending",
          amountCents: input.amountCents
        })
        .returning();
      const intent = inserted[0];
      if (!intent) throw new Error("Intent non creato");

      await tx.insert(giftLocks).values({
        giftId: gift.id,
        intentId: intent.id,
        expiresAt: input.expiresAt
      });
      return intent;
    });
  } catch (error) {
    if (error instanceof TransactionError) throw error;
    const idempotent = await recoverIdempotency(
      db,
      error,
      input.idempotencyKey
    );
    if (idempotent) return resolveIdempotentIntent(idempotent, requested);
    if (
      isUniqueViolation(error) &&
      ["gift_locks_pkey", "gift_locks_intent_unique"].includes(
        constraintName(error)
      )
    ) {
      throw new TransactionError("gift_unavailable");
    }
    throw error;
  }
}

export async function contributeToGift(
  db: WeddingDatabase,
  input: NewIntentInput
): Promise<GiftIntent> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new TransactionError("amount_unavailable");
  }

  const requested = requestSemantics(input, "contribution");
  try {
    return await runSerializable(db, async (tx) => {
      const idempotent = await tx
        .select()
        .from(giftIntents)
        .where(eq(giftIntents.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (idempotent[0]) {
        return resolveIdempotentIntent(idempotent[0], requested);
      }

      const gift = await lockAndReadGift(tx, input.giftId);
      if (!gift || gift.completed) {
        throw new TransactionError("gift_unavailable");
      }

      const fullLock = await tx
        .select({ giftId: giftLocks.giftId })
        .from(giftLocks)
        .where(eq(giftLocks.giftId, gift.id))
        .limit(1);
      if (fullLock[0]) throw new TransactionError("gift_unavailable");

      const commitments = await tx
        .select({
          kind: giftIntents.kind,
          status: giftIntents.status,
          amountCents: giftIntents.amountCents,
          appliedAmountCents: giftIntents.appliedAmountCents,
          expiresAt: giftIntents.expiresAt
        })
        .from(giftIntents)
        .where(eq(giftIntents.giftId, gift.id));
      const now = new Date();
      const verifiedCents = commitments
        .filter((intent) => intent.status === "verified")
        .reduce((sum, intent) => sum + intent.appliedAmountCents, 0);
      const activePendingCents = commitments
        .filter(
          (intent) =>
            intent.kind === "contribution" &&
            intent.status === "pending" &&
            intent.expiresAt > now
        )
        .reduce((sum, intent) => sum + intent.amountCents, 0);
      const availableCents = Math.max(
        0,
        gift.priceCents - verifiedCents - activePendingCents
      );
      if (input.amountCents > availableCents) {
        throw new TransactionError("amount_unavailable");
      }

      const inserted = await tx
        .insert(giftIntents)
        .values({
          ...input,
          kind: "contribution",
          status: "pending"
        })
        .returning();
      if (!inserted[0]) throw new Error("Intent non creato");
      return inserted[0];
    });
  } catch (error) {
    if (error instanceof TransactionError) throw error;
    const idempotent = await recoverIdempotency(
      db,
      error,
      input.idempotencyKey
    );
    if (idempotent) return resolveIdempotentIntent(idempotent, requested);
    throw error;
  }
}

export async function verifyIntent(
  db: WeddingDatabase,
  input: {
    intentId: string;
    receivedAmountCents: number;
    actorAdminId?: string;
  }
): Promise<GiftIntent> {
  if (
    !Number.isSafeInteger(input.receivedAmountCents) ||
    input.receivedAmountCents < 0
  ) {
    throw new TypeError(
      "receivedAmountCents deve essere un intero non negativo"
    );
  }

  return runSerializable(db, async (tx) => {
    const initial = await tx
      .select({ giftId: giftIntents.giftId })
      .from(giftIntents)
      .where(eq(giftIntents.id, input.intentId))
      .limit(1);
    if (!initial[0]) throw new TransactionError("intent_not_found", 404);

    const gift = await lockAndReadGift(tx, initial[0].giftId);
    if (!gift) throw new TransactionError("gift_unavailable");
    await tx.execute(
      sql`select id from ${giftIntents} where id = ${input.intentId} for update`
    );
    const intentRows = await tx
      .select()
      .from(giftIntents)
      .where(eq(giftIntents.id, input.intentId))
      .limit(1);
    const intent = intentRows[0];
    if (!intent) throw new TransactionError("intent_not_found", 404);
    if (intent.status === "verified") return intent;
    if (intent.status !== "pending") {
      throw new TransactionError("intent_not_pending");
    }

    const verified = await tx
      .select({ appliedAmountCents: giftIntents.appliedAmountCents })
      .from(giftIntents)
      .where(
        and(eq(giftIntents.giftId, gift.id), eq(giftIntents.status, "verified"))
      );
    const alreadyAppliedCents = verified.reduce(
      (sum, row) => sum + row.appliedAmountCents,
      0
    );
    const amounts = getVerificationAmounts({
      priceCents: gift.priceCents,
      alreadyAppliedCents,
      intentAmountCents: intent.amountCents,
      receivedAmountCents: input.receivedAmountCents
    });
    const now = new Date();
    const updated = await tx
      .update(giftIntents)
      .set({
        status: "verified",
        receivedAmountCents: amounts.receivedAmountCents,
        appliedAmountCents: amounts.appliedAmountCents,
        verifiedAt: now,
        updatedAt: now
      })
      .where(eq(giftIntents.id, intent.id))
      .returning();

    if (amounts.completesGift) {
      await tx
        .update(gifts)
        .set({ completed: true, updatedAt: now })
        .where(eq(gifts.id, gift.id));
    }
    await tx.delete(giftLocks).where(eq(giftLocks.intentId, intent.id));
    await tx.insert(auditLogs).values({
      actorAdminId: input.actorAdminId,
      actorType: "admin",
      action: "gift_intent.verified",
      targetType: "gift_intent",
      targetId: intent.id,
      metadata: amounts
    });
    if (!updated[0]) throw new Error("Intent non aggiornato");
    return updated[0];
  });
}

export async function cancelIntent(
  db: WeddingDatabase,
  input: {
    intentId: string;
    actor: "guest" | "admin";
    actorAdminId?: string;
  }
): Promise<GiftIntent> {
  return runSerializable(db, async (tx) => {
    const initial = await tx
      .select({ giftId: giftIntents.giftId })
      .from(giftIntents)
      .where(eq(giftIntents.id, input.intentId))
      .limit(1);
    if (!initial[0]) throw new TransactionError("intent_not_found", 404);

    await lockAndReadGift(tx, initial[0].giftId);
    await tx.execute(
      sql`select id from ${giftIntents} where id = ${input.intentId} for update`
    );
    const rows = await tx
      .select()
      .from(giftIntents)
      .where(eq(giftIntents.id, input.intentId))
      .limit(1);
    const intent = rows[0];
    if (!intent) throw new TransactionError("intent_not_found", 404);
    if (intent.status === "cancelled") return intent;
    assertCancellationAllowed({
      actor: input.actor,
      status: intent.status,
      paymentDeclaredAt: intent.paymentDeclaredAt
    });

    const now = new Date();
    const updated = await tx
      .update(giftIntents)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(eq(giftIntents.id, intent.id))
      .returning();
    await tx.delete(giftLocks).where(eq(giftLocks.intentId, intent.id));
    await tx.insert(auditLogs).values({
      actorAdminId: input.actorAdminId,
      actorType: input.actor,
      action: "gift_intent.cancelled",
      targetType: "gift_intent",
      targetId: intent.id,
      metadata: {}
    });
    if (!updated[0]) throw new Error("Intent non aggiornato");
    return updated[0];
  });
}

export async function declareIntentPayment(
  db: WeddingDatabase,
  input: { intentId: string }
): Promise<GiftIntent> {
  return runSerializable(db, async (tx) => {
    const initial = await tx
      .select({ giftId: giftIntents.giftId })
      .from(giftIntents)
      .where(eq(giftIntents.id, input.intentId))
      .limit(1);
    if (!initial[0]) throw new TransactionError("intent_not_found", 404);

    await lockAndReadGift(tx, initial[0].giftId);
    await tx.execute(
      sql`select id from ${giftIntents} where id = ${input.intentId} for update`
    );
    const rows = await tx
      .select()
      .from(giftIntents)
      .where(eq(giftIntents.id, input.intentId))
      .limit(1);
    const intent = rows[0];
    if (!intent) throw new TransactionError("intent_not_found", 404);
    assertPaymentDeclarationAllowed({
      status: intent.status,
      paymentDeclaredAt: intent.paymentDeclaredAt
    });
    if (intent.paymentDeclaredAt) return intent;

    const now = new Date();
    const updated = await tx
      .update(giftIntents)
      .set({ paymentDeclaredAt: now, updatedAt: now })
      .where(eq(giftIntents.id, intent.id))
      .returning();
    await tx.insert(auditLogs).values({
      actorType: "guest",
      action: "gift_intent.payment_declared",
      targetType: "gift_intent",
      targetId: intent.id,
      metadata: { paymentDeclared: true }
    });
    if (!updated[0]) throw new Error("Intent non aggiornato");
    return updated[0];
  });
}
