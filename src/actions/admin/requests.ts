"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { giftIntents, giftLocks, gifts } from "@/db/schema";
import { TransactionError } from "@/db/transactions/errors";
import {
  assertCancellationAllowed,
  assertGiftReservationAvailable,
  getVerificationAmounts
} from "@/db/transactions/policies";
import {
  deliverQueuedVerificationNotification,
  enqueueVerificationDelivery
} from "@/lib/email";
import { runAdminIdempotentTransaction as executeOnce } from "@/lib/admin/idempotency";
import { encryptSecret } from "@/lib/security/crypto";
import { hashEmail, hashFingerprint, hashToken } from "@/lib/security/hashing";

import {
  type AdminActionResult,
  authorizedAdmin,
  refreshAdmin
} from "./shared";

const idempotencySchema = z.string().trim().min(8).max(128);
const intentIdSchema = z.uuid();

export async function verifyRequestAction(formData: FormData) {
  const admin = await authorizedAdmin("request.verify");
  const parsed = z
    .object({
      intentId: intentIdSchema,
      receivedAmountCents: z.coerce.number().int().min(0),
      idempotencyKey: idempotencySchema
    })
    .parse({
      intentId: formData.get("intentId"),
      receivedAmountCents: formData.get("receivedAmountCents"),
      idempotencyKey: formData.get("idempotencyKey")
    });
  const outcome = await executeOnce({
    actorAdminId: admin.id,
    action: "request.verify",
    entityId: parsed.intentId,
    idempotencyKey: parsed.idempotencyKey,
    payload: { receivedAmountCents: parsed.receivedAmountCents },
    effect: async (tx) => {
      const initial = await tx
        .select({ giftId: giftIntents.giftId })
        .from(giftIntents)
        .where(eq(giftIntents.id, parsed.intentId))
        .limit(1);
      if (!initial[0]) throw new TransactionError("intent_not_found", 404);
      await tx.execute(
        sql`select id from ${gifts} where id = ${initial[0].giftId} for update`
      );
      const giftRows = await tx
        .select()
        .from(gifts)
        .where(eq(gifts.id, initial[0].giftId))
        .limit(1);
      const gift = giftRows[0];
      if (!gift) throw new TransactionError("gift_unavailable");
      await tx.execute(
        sql`select id from ${giftIntents} where id = ${parsed.intentId} for update`
      );
      const intentRows = await tx
        .select()
        .from(giftIntents)
        .where(eq(giftIntents.id, parsed.intentId))
        .limit(1);
      const intent = intentRows[0];
      if (!intent) throw new TransactionError("intent_not_found", 404);
      if (intent.status !== "pending")
        throw new TransactionError("intent_not_pending");
      const verified = await tx
        .select({ appliedAmountCents: giftIntents.appliedAmountCents })
        .from(giftIntents)
        .where(
          and(
            eq(giftIntents.giftId, gift.id),
            eq(giftIntents.status, "verified")
          )
        );
      const amounts = getVerificationAmounts({
        priceCents: gift.priceCents,
        alreadyAppliedCents: verified.reduce(
          (sum, row) => sum + row.appliedAmountCents,
          0
        ),
        intentAmountCents: intent.amountCents,
        receivedAmountCents: parsed.receivedAmountCents
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
        .where(
          and(eq(giftIntents.id, intent.id), eq(giftIntents.status, "pending"))
        )
        .returning();
      if (!updated[0]) throw new TransactionError("intent_not_pending");
      if (amounts.completesGift)
        await tx
          .update(gifts)
          .set({ completed: true, updatedAt: now })
          .where(eq(gifts.id, gift.id));
      await tx.delete(giftLocks).where(eq(giftLocks.intentId, intent.id));
      const deliveryId = await enqueueVerificationDelivery(tx, {
        intentId: intent.id,
        idempotencyKey: hashFingerprint(
          `verify:${admin.id}:${parsed.idempotencyKey}`,
          required("REQUEST_FINGERPRINT_SECRET")
        ),
        hashingSecret: required("REQUEST_FINGERPRINT_SECRET")
      });
      return { intentId: intent.id, status: updated[0].status, deliveryId };
    },
    audit: (result) => ({
      action: "gift_intent.verified",
      targetType: "gift_intent",
      targetId: result.intentId,
      metadata: { receivedAmountCents: parsed.receivedAmountCents }
    })
  });
  await deliverQueuedVerificationNotification(getDatabase(), {
    deliveryId: outcome.result.deliveryId,
    encryptionKey: required("DATA_ENCRYPTION_KEY"),
    hashingSecret: required("REQUEST_FINGERPRINT_SECRET")
  });
  await refreshAdmin("/admin/richieste");
  return outcome;
}

export async function cancelRequestAction(formData: FormData) {
  const admin = await authorizedAdmin("request.cancel");
  const intentId = intentIdSchema.parse(formData.get("intentId"));
  const idempotencyKey = idempotencySchema.parse(
    formData.get("idempotencyKey")
  );
  const outcome = await executeOnce({
    actorAdminId: admin.id,
    action: "request.cancel",
    entityId: intentId,
    idempotencyKey,
    payload: {},
    effect: async (tx) => {
      await tx.execute(
        sql`select id from ${giftIntents} where id = ${intentId} for update`
      );
      const rows = await tx
        .select()
        .from(giftIntents)
        .where(eq(giftIntents.id, intentId))
        .limit(1);
      const intent = rows[0];
      if (!intent) throw new TransactionError("intent_not_found", 404);
      assertCancellationAllowed({
        actor: "admin",
        status: intent.status,
        paymentDeclaredAt: intent.paymentDeclaredAt
      });
      const now = new Date();
      const updated = await tx
        .update(giftIntents)
        .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
        .where(eq(giftIntents.id, intentId))
        .returning();
      if (!updated[0]) throw new TransactionError("intent_not_found", 404);
      await tx.delete(giftLocks).where(eq(giftLocks.intentId, intentId));
      return { intentId, status: updated[0].status };
    },
    audit: () => ({
      action: "gift_intent.cancelled",
      targetType: "gift_intent",
      targetId: intentId
    })
  });
  await refreshAdmin("/admin/richieste");
  return outcome;
}

export async function rejectRequestAction(formData: FormData) {
  const admin = await authorizedAdmin("request.reject");
  const intentId = intentIdSchema.parse(formData.get("intentId"));
  const idempotencyKey = idempotencySchema.parse(
    formData.get("idempotencyKey")
  );
  const outcome = await executeOnce({
    actorAdminId: admin.id,
    action: "request.reject",
    entityId: intentId,
    idempotencyKey,
    payload: {},
    effect: async (tx) => {
      const now = new Date();
      await tx.execute(
        sql`select id from ${giftIntents} where id = ${intentId} for update`
      );
      const current = await tx
        .select({ status: giftIntents.status })
        .from(giftIntents)
        .where(eq(giftIntents.id, intentId))
        .limit(1);
      if (!current[0]) throw new TransactionError("intent_not_found", 404);
      if (current[0].status !== "pending")
        throw new TransactionError("intent_not_pending");
      const updated = await tx
        .update(giftIntents)
        .set({ status: "rejected", rejectedAt: now, updatedAt: now })
        .where(
          and(eq(giftIntents.id, intentId), eq(giftIntents.status, "pending"))
        )
        .returning({ id: giftIntents.id });
      if (!updated[0]) throw new TransactionError("intent_not_pending");
      await tx.delete(giftLocks).where(eq(giftLocks.intentId, intentId));
      return { intentId, status: "rejected" };
    },
    audit: () => ({
      action: "gift_intent.rejected",
      targetType: "gift_intent",
      targetId: intentId
    })
  });
  await refreshAdmin("/admin/richieste");
  return outcome;
}

export async function unlockRequestAction(formData: FormData) {
  const admin = await authorizedAdmin("request.unlock");
  const intentId = intentIdSchema.parse(formData.get("intentId"));
  const idempotencyKey = idempotencySchema.parse(
    formData.get("idempotencyKey")
  );
  const outcome = await executeOnce({
    actorAdminId: admin.id,
    action: "request.unlock",
    entityId: intentId,
    idempotencyKey,
    payload: {},
    effect: async (tx) => {
      await tx.execute(
        sql`select id from ${giftIntents} where id = ${intentId} for update`
      );
      const current = await tx
        .select({ status: giftIntents.status })
        .from(giftIntents)
        .where(eq(giftIntents.id, intentId))
        .limit(1);
      if (!current[0]) throw new TransactionError("intent_not_found", 404);
      if (current[0].status !== "pending")
        throw new TransactionError("intent_not_pending");
      const deleted = await tx
        .delete(giftLocks)
        .where(eq(giftLocks.intentId, intentId))
        .returning({ giftId: giftLocks.giftId });
      if (!deleted[0]) throw new TransactionError("gift_unavailable");
      return { intentId, status: "unlocked" };
    },
    audit: () => ({
      action: "gift_intent.unlocked",
      targetType: "gift_intent",
      targetId: intentId
    })
  });
  await refreshAdmin("/admin/richieste");
  return outcome;
}

export async function extendRequestAction(formData: FormData) {
  const admin = await authorizedAdmin("request.extend");
  const parsed = z
    .object({
      intentId: intentIdSchema,
      expiresAt: z.coerce.date(),
      idempotencyKey: idempotencySchema
    })
    .parse({
      intentId: formData.get("intentId"),
      expiresAt: formData.get("expiresAt"),
      idempotencyKey: formData.get("idempotencyKey")
    });
  if (parsed.expiresAt <= new Date())
    throw new TypeError("La scadenza deve essere futura");
  const outcome = await executeOnce({
    actorAdminId: admin.id,
    action: "request.extend",
    entityId: parsed.intentId,
    idempotencyKey: parsed.idempotencyKey,
    payload: { expiresAt: parsed.expiresAt.toISOString() },
    effect: async (tx) => {
      await tx.execute(
        sql`select id from ${giftIntents} where id = ${parsed.intentId} for update`
      );
      const current = await tx
        .select({ status: giftIntents.status })
        .from(giftIntents)
        .where(eq(giftIntents.id, parsed.intentId))
        .limit(1);
      if (!current[0]) throw new TransactionError("intent_not_found", 404);
      if (current[0].status !== "pending")
        throw new TransactionError("intent_not_pending");
      const updated = await tx
        .update(giftIntents)
        .set({ expiresAt: parsed.expiresAt, updatedAt: new Date() })
        .where(
          and(
            eq(giftIntents.id, parsed.intentId),
            eq(giftIntents.status, "pending")
          )
        )
        .returning({ id: giftIntents.id });
      if (!updated[0]) throw new TransactionError("intent_not_pending");
      await tx
        .update(giftLocks)
        .set({ expiresAt: parsed.expiresAt })
        .where(eq(giftLocks.intentId, parsed.intentId));
      return { intentId: parsed.intentId, status: "extended" };
    },
    audit: () => ({
      action: "gift_intent.extended",
      targetType: "gift_intent",
      targetId: parsed.intentId,
      metadata: { expiresAt: parsed.expiresAt }
    })
  });
  await refreshAdmin("/admin/richieste");
  return outcome;
}

export async function saveRequestNoteAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("request.note");
  const parsed = z
    .object({
      intentId: intentIdSchema,
      note: z.string().trim().max(2_000),
      idempotencyKey: idempotencySchema
    })
    .safeParse({
      intentId: formData.get("intentId"),
      note: formData.get("note"),
      idempotencyKey: formData.get("idempotencyKey")
    });
  if (!parsed.success) return { ok: false, message: "Nota non valida" };
  await executeOnce({
    actorAdminId: admin.id,
    action: "request.note",
    entityId: parsed.data.intentId,
    idempotencyKey: parsed.data.idempotencyKey,
    payload: { note: parsed.data.note },
    effect: async (tx) => {
      const updated = await tx
        .update(giftIntents)
        .set({ adminNote: parsed.data.note, updatedAt: new Date() })
        .where(eq(giftIntents.id, parsed.data.intentId))
        .returning({ id: giftIntents.id });
      if (!updated[0]) throw new TransactionError("intent_not_found", 404);
      return { intentId: parsed.data.intentId, status: "noted" };
    },
    audit: () => ({
      action: "gift_intent.note_saved",
      targetType: "gift_intent",
      targetId: parsed.data.intentId,
      metadata: { hasNote: parsed.data.note.length > 0 }
    })
  });
  await refreshAdmin("/admin/richieste");
  return { ok: true, message: "Nota salvata" };
}

export async function createManualRequestAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("request.manual");
  const parsed = z
    .object({
      giftId: z.uuid(),
      kind: z.enum(["full_gift", "contribution"]),
      method: z.enum(["external_purchase", "bank_transfer"]),
      amountCents: z.coerce.number().int().positive(),
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      email: z.email(),
      idempotencyKey: idempotencySchema
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Richiesta non valida" };
  const encryptionKey = required("DATA_ENCRYPTION_KEY");
  const pepper = required("REQUEST_FINGERPRINT_SECRET");
  const guestToken = randomBytes(32).toString("base64url");
  const intentId = randomUUID();
  const mutationInput = {
    publicReference: `M-${randomUUID()}`,
    giftId: parsed.data.giftId,
    method: parsed.data.method,
    amountCents: parsed.data.amountCents,
    idempotencyKey: randomUUID(),
    requestFingerprintHash: hashFingerprint(`manual:${intentId}`, pepper),
    guestTokenHash: hashToken(guestToken, required("GUEST_TOKEN_SECRET")),
    guestDetailsEncrypted: encryptSecret(
      JSON.stringify({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        privacyVersion: "admin-manual"
      }),
      encryptionKey
    ),
    guestEmailHash: hashEmail(parsed.data.email, pepper),
    expiresAt: new Date(Date.now() + 48 * 60 * 60_000)
  };
  await executeOnce({
    actorAdminId: admin.id,
    action: "request.manual",
    entityId: parsed.data.giftId,
    idempotencyKey: parsed.data.idempotencyKey,
    payload: {
      kind: parsed.data.kind,
      method: parsed.data.method,
      amountCents: parsed.data.amountCents,
      identityHash: hashFingerprint(
        JSON.stringify({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email.trim().toLowerCase()
        }),
        pepper
      )
    },
    effect: async (tx) => {
      await tx.execute(
        sql`select id from ${gifts} where id = ${parsed.data.giftId} for update`
      );
      const giftRows = await tx
        .select()
        .from(gifts)
        .where(eq(gifts.id, parsed.data.giftId))
        .limit(1);
      const gift = giftRows[0];
      if (!gift || gift.completed || !gift.published || gift.archivedAt)
        throw new TransactionError("gift_unavailable");
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
      if (parsed.data.kind === "full_gift") {
        if (parsed.data.amountCents !== gift.priceCents)
          throw new TransactionError("gift_unavailable");
        assertGiftReservationAvailable({
          now: new Date(),
          contributions: commitments
        });
      } else {
        const fullLock = await tx
          .select({ id: giftLocks.giftId })
          .from(giftLocks)
          .where(eq(giftLocks.giftId, gift.id))
          .limit(1);
        if (fullLock[0]) throw new TransactionError("gift_unavailable");
        const now = new Date();
        const verifiedCents = commitments
          .filter((item) => item.status === "verified")
          .reduce((sum, item) => sum + item.appliedAmountCents, 0);
        const pendingCents = commitments
          .filter(
            (item) =>
              item.kind === "contribution" &&
              item.status === "pending" &&
              item.expiresAt > now
          )
          .reduce((sum, item) => sum + item.amountCents, 0);
        if (
          parsed.data.amountCents >
          Math.max(0, gift.priceCents - verifiedCents - pendingCents)
        )
          throw new TransactionError("amount_unavailable");
      }
      const inserted = await tx
        .insert(giftIntents)
        .values({
          ...mutationInput,
          kind: parsed.data.kind,
          status: "pending"
        })
        .returning();
      if (!inserted[0]) throw new Error("Intent non creato");
      if (parsed.data.kind === "full_gift")
        await tx.insert(giftLocks).values({
          giftId: gift.id,
          intentId: inserted[0].id,
          expiresAt: mutationInput.expiresAt
        });
      return { intentId: inserted[0].id, status: inserted[0].status };
    },
    audit: (result) => ({
      action: "gift_intent.manual_created",
      targetType: "gift_intent",
      targetId: result.intentId,
      metadata: { kind: parsed.data.kind, amountCents: parsed.data.amountCents }
    })
  });
  await refreshAdmin("/admin/richieste");
  return { ok: true, message: "Richiesta inserita" };
}

export async function resendRequestEmailAction(formData: FormData) {
  const admin = await authorizedAdmin("request.resend-email");
  const intentId = intentIdSchema.parse(formData.get("intentId"));
  const idempotencyKey = idempotencySchema.parse(
    formData.get("idempotencyKey")
  );
  return executeOnce({
    actorAdminId: admin.id,
    action: "request.resend-email",
    entityId: intentId,
    idempotencyKey,
    payload: {},
    effect: async (tx) => {
      const deliveryId = await enqueueVerificationDelivery(tx, {
        intentId,
        idempotencyKey: hashFingerprint(
          `resend:${admin.id}:${idempotencyKey}`,
          required("REQUEST_FINGERPRINT_SECRET")
        ),
        hashingSecret: required("REQUEST_FINGERPRINT_SECRET")
      });
      return { intentId, status: "queued", deliveryId };
    },
    audit: () => ({
      action: "gift_intent.email_resent",
      targetType: "gift_intent",
      targetId: intentId
    })
  }).then(async (outcome) => {
    await deliverQueuedVerificationNotification(getDatabase(), {
      deliveryId: outcome.result.deliveryId,
      encryptionKey: required("DATA_ENCRYPTION_KEY"),
      hashingSecret: required("REQUEST_FINGERPRINT_SECRET")
    });
    return outcome;
  });
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} non configurato`);
  return value;
}
