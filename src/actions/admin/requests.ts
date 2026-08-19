"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { adminActionReceipts, giftIntents, giftLocks } from "@/db/schema";
import { cancelIntent, verifyIntent } from "@/db/transactions";
import { deliverVerificationNotification } from "@/lib/email";
import { encryptSecret } from "@/lib/security/crypto";
import { hashEmail, hashFingerprint, hashToken } from "@/lib/security/hashing";

import {
  type AdminActionResult,
  authorizedAdmin,
  refreshAdmin,
  writeAdminAudit
} from "./shared";

const idempotencySchema = z.string().trim().min(8).max(128);
const intentIdSchema = z.uuid();

async function executeOnce<T extends Record<string, unknown>>(input: {
  actorAdminId: string;
  action: string;
  idempotencyKey: string;
  effect: () => Promise<T>;
}): Promise<{ result: T; replayed: boolean }> {
  const db = getDatabase();
  const inserted = await db
    .insert(adminActionReceipts)
    .values({
      actorAdminId: input.actorAdminId,
      action: input.action,
      idempotencyKey: input.idempotencyKey,
      result: { state: "started" }
    })
    .onConflictDoNothing()
    .returning({ id: adminActionReceipts.id });
  if (!inserted[0]) {
    const existing = await db
      .select({ result: adminActionReceipts.result })
      .from(adminActionReceipts)
      .where(
        and(
          eq(adminActionReceipts.actorAdminId, input.actorAdminId),
          eq(adminActionReceipts.action, input.action),
          eq(adminActionReceipts.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1);
    return { result: existing[0]?.result as T, replayed: true };
  }
  try {
    const result = await input.effect();
    await db
      .update(adminActionReceipts)
      .set({ result })
      .where(eq(adminActionReceipts.id, inserted[0].id));
    return { result, replayed: false };
  } catch (error) {
    await db
      .delete(adminActionReceipts)
      .where(eq(adminActionReceipts.id, inserted[0].id));
    throw error;
  }
}

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
    idempotencyKey: parsed.idempotencyKey,
    effect: async () => {
      const intent = await verifyIntent(getDatabase(), {
        intentId: parsed.intentId,
        receivedAmountCents: parsed.receivedAmountCents,
        actorAdminId: admin.id
      });
      await deliverVerificationNotification(getDatabase(), {
        intentId: intent.id,
        encryptionKey: required("DATA_ENCRYPTION_KEY"),
        hashingSecret: required("REQUEST_FINGERPRINT_SECRET")
      });
      return { intentId: intent.id, status: intent.status };
    }
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
    idempotencyKey,
    effect: async () => {
      const intent = await cancelIntent(getDatabase(), {
        intentId,
        actor: "admin",
        actorAdminId: admin.id
      });
      return { intentId: intent.id, status: intent.status };
    }
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
    idempotencyKey,
    effect: async () => {
      const now = new Date();
      await getDatabase().transaction(async (tx) => {
        await tx
          .update(giftIntents)
          .set({ status: "rejected", rejectedAt: now, updatedAt: now })
          .where(
            and(eq(giftIntents.id, intentId), eq(giftIntents.status, "pending"))
          );
        await tx.delete(giftLocks).where(eq(giftLocks.intentId, intentId));
      });
      await writeAdminAudit({
        actorAdminId: admin.id,
        action: "gift_intent.rejected",
        targetType: "gift_intent",
        targetId: intentId
      });
      return { intentId, status: "rejected" };
    }
  });
  await refreshAdmin("/admin/richieste");
  return outcome;
}

export async function unlockRequestAction(formData: FormData) {
  const admin = await authorizedAdmin("request.unlock");
  const intentId = intentIdSchema.parse(formData.get("intentId"));
  await getDatabase().delete(giftLocks).where(eq(giftLocks.intentId, intentId));
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "gift_intent.unlocked",
    targetType: "gift_intent",
    targetId: intentId
  });
  await refreshAdmin("/admin/richieste");
}

export async function extendRequestAction(formData: FormData) {
  const admin = await authorizedAdmin("request.extend");
  const parsed = z
    .object({ intentId: intentIdSchema, expiresAt: z.coerce.date() })
    .parse({
      intentId: formData.get("intentId"),
      expiresAt: formData.get("expiresAt")
    });
  await getDatabase().transaction(async (tx) => {
    await tx
      .update(giftIntents)
      .set({ expiresAt: parsed.expiresAt, updatedAt: new Date() })
      .where(
        and(
          eq(giftIntents.id, parsed.intentId),
          eq(giftIntents.status, "pending")
        )
      );
    await tx
      .update(giftLocks)
      .set({ expiresAt: parsed.expiresAt })
      .where(eq(giftLocks.intentId, parsed.intentId));
  });
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "gift_intent.extended",
    targetType: "gift_intent",
    targetId: parsed.intentId,
    metadata: { expiresAt: parsed.expiresAt }
  });
  await refreshAdmin("/admin/richieste");
}

export async function saveRequestNoteAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("request.note");
  const parsed = z
    .object({ intentId: intentIdSchema, note: z.string().trim().max(2_000) })
    .safeParse({
      intentId: formData.get("intentId"),
      note: formData.get("note")
    });
  if (!parsed.success) return { ok: false, message: "Nota non valida" };
  await getDatabase()
    .update(giftIntents)
    .set({ adminNote: parsed.data.note, updatedAt: new Date() })
    .where(eq(giftIntents.id, parsed.data.intentId));
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "gift_intent.note_saved",
    targetType: "gift_intent",
    targetId: parsed.data.intentId,
    metadata: { hasNote: parsed.data.note.length > 0 }
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
      email: z.email()
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Richiesta non valida" };
  const encryptionKey = required("DATA_ENCRYPTION_KEY");
  const pepper = required("REQUEST_FINGERPRINT_SECRET");
  const guestToken = randomBytes(32).toString("base64url");
  const intentId = randomUUID();
  await getDatabase()
    .insert(giftIntents)
    .values({
      id: intentId,
      publicReference: `M-${randomUUID()}`,
      giftId: parsed.data.giftId,
      kind: parsed.data.kind,
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
    });
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "gift_intent.manual_created",
    targetType: "gift_intent",
    targetId: intentId,
    metadata: { kind: parsed.data.kind, amountCents: parsed.data.amountCents }
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
    idempotencyKey,
    effect: async () => {
      await deliverVerificationNotification(getDatabase(), {
        intentId,
        encryptionKey: required("DATA_ENCRYPTION_KEY"),
        hashingSecret: required("REQUEST_FINGERPRINT_SECRET")
      });
      await writeAdminAudit({
        actorAdminId: admin.id,
        action: "gift_intent.email_resent",
        targetType: "gift_intent",
        targetId: intentId
      });
      return { intentId, status: "sent" };
    }
  });
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} non configurato`);
  return value;
}
