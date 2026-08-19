import "server-only";

import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { z } from "zod";

import type { WeddingDatabase } from "@/db";
import { emailDeliveries, giftIntents, gifts } from "@/db/schema";
import { formatCurrency } from "@/lib/domain/currency";
import { decryptSecret } from "@/lib/security/crypto";
import { hashEmail, hashFingerprint } from "@/lib/security/hashing";
import type { AdminTransaction } from "@/lib/admin/idempotency";

import { renderVerificationEmail, type RenderedEmail } from "./templates";

type DeliveryStatus = "sent" | "failed" | "skipped";

async function recordDelivery(
  db: WeddingDatabase,
  input: {
    intentId: string;
    recipientHash: string;
    templateKey: string;
    status: DeliveryStatus;
    providerMessageIdHash?: string;
    failureCode?: string;
  }
): Promise<void> {
  try {
    await db.insert(emailDeliveries).values({
      intentId: input.intentId,
      recipientHash: input.recipientHash,
      templateKey: input.templateKey,
      status: input.status,
      providerMessageIdHash: input.providerMessageIdHash,
      failureCode: input.failureCode,
      sentAt: input.status === "sent" ? new Date() : undefined
    });
  } catch {
    // Anche il tracking email è best-effort e non deve esporre dati o fallire la mutation.
  }
}

export async function deliverTransactionalEmail(
  db: WeddingDatabase,
  input: {
    intentId: string;
    recipient: string;
    templateKey: string;
    email: RenderedEmail;
    hashingSecret: string;
  }
): Promise<void> {
  const recipientHash = hashEmail(input.recipient, input.hashingSecret);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    await recordDelivery(db, {
      intentId: input.intentId,
      recipientHash,
      templateKey: input.templateKey,
      status: "skipped",
      failureCode: "provider_not_configured"
    });
    return;
  }

  try {
    const result = await new Resend(apiKey).emails.send({
      from,
      to: input.recipient,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text
    });
    if (result.error || !result.data?.id) {
      await recordDelivery(db, {
        intentId: input.intentId,
        recipientHash,
        templateKey: input.templateKey,
        status: "failed",
        failureCode: "provider_rejected"
      });
      return;
    }
    await recordDelivery(db, {
      intentId: input.intentId,
      recipientHash,
      templateKey: input.templateKey,
      status: "sent",
      providerMessageIdHash: hashFingerprint(
        result.data.id,
        input.hashingSecret
      )
    });
  } catch {
    await recordDelivery(db, {
      intentId: input.intentId,
      recipientHash,
      templateKey: input.templateKey,
      status: "failed",
      failureCode: "provider_unavailable"
    });
  }
}

const encryptedGuestSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.email(),
  phone: z.string().max(30).optional(),
  message: z.string().max(500).optional(),
  privacyVersion: z.string().min(1).max(50)
});

export async function enqueueVerificationDelivery(
  tx: AdminTransaction,
  input: { intentId: string; idempotencyKey: string; hashingSecret: string }
): Promise<string> {
  const intents = await tx
    .select({ recipientHash: giftIntents.guestEmailHash })
    .from(giftIntents)
    .where(eq(giftIntents.id, input.intentId))
    .limit(1);
  if (!intents[0]) throw new Error("Richiesta non trovata");
  const inserted = await tx
    .insert(emailDeliveries)
    .values({
      intentId: input.intentId,
      recipientHash:
        intents[0].recipientHash ??
        hashFingerprint(input.intentId, input.hashingSecret),
      templateKey: "gift_verification",
      idempotencyKey: input.idempotencyKey,
      status: "pending"
    })
    .onConflictDoNothing()
    .returning({ id: emailDeliveries.id });
  if (inserted[0]) return inserted[0].id;
  const existing = await tx
    .select({ id: emailDeliveries.id })
    .from(emailDeliveries)
    .where(eq(emailDeliveries.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (!existing[0]) throw new Error("Consegna email non accodata");
  return existing[0].id;
}

export async function deliverQueuedVerificationNotification(
  db: WeddingDatabase,
  input: {
    deliveryId: string;
    encryptionKey: string;
    hashingSecret: string;
  }
): Promise<void> {
  const rows = await db
    .select({
      deliveryStatus: emailDeliveries.status,
      idempotencyKey: emailDeliveries.idempotencyKey,
      encryptedGuest: giftIntents.guestDetailsEncrypted,
      reference: giftIntents.publicReference,
      amountCents: giftIntents.appliedAmountCents,
      giftTitle: gifts.title
    })
    .from(emailDeliveries)
    .innerJoin(giftIntents, eq(giftIntents.id, emailDeliveries.intentId))
    .innerJoin(gifts, eq(gifts.id, giftIntents.giftId))
    .where(eq(emailDeliveries.id, input.deliveryId))
    .limit(1);
  const queued = rows[0];
  if (!queued || queued.deliveryStatus === "sent") return;
  let guest: z.infer<typeof encryptedGuestSchema>;
  try {
    guest = encryptedGuestSchema.parse(
      JSON.parse(decryptSecret(queued.encryptedGuest, input.encryptionKey))
    );
  } catch {
    await db
      .update(emailDeliveries)
      .set({ status: "failed", failureCode: "guest_details_unavailable" })
      .where(eq(emailDeliveries.id, input.deliveryId));
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    await db
      .update(emailDeliveries)
      .set({ status: "skipped", failureCode: "provider_not_configured" })
      .where(eq(emailDeliveries.id, input.deliveryId));
    return;
  }
  try {
    const rendered = renderVerificationEmail({
      firstName: guest.firstName,
      giftName: queued.giftTitle,
      reference: queued.reference,
      amount: formatCurrency(queued.amountCents)
    });
    const result = await new Resend(apiKey).emails.send(
      {
        from,
        to: guest.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
      },
      queued.idempotencyKey
        ? { idempotencyKey: queued.idempotencyKey }
        : undefined
    );
    if (result.error || !result.data?.id) throw new Error("provider_rejected");
    await db
      .update(emailDeliveries)
      .set({
        status: "sent",
        failureCode: null,
        sentAt: new Date(),
        providerMessageIdHash: hashFingerprint(
          result.data.id,
          input.hashingSecret
        )
      })
      .where(eq(emailDeliveries.id, input.deliveryId));
  } catch {
    await db
      .update(emailDeliveries)
      .set({ status: "failed", failureCode: "provider_unavailable" })
      .where(eq(emailDeliveries.id, input.deliveryId));
  }
}

export async function deliverVerificationNotification(
  db: WeddingDatabase,
  input: {
    intentId: string;
    encryptionKey: string;
    hashingSecret: string;
  }
): Promise<void> {
  const rows = await db
    .select({
      encryptedGuest: giftIntents.guestDetailsEncrypted,
      recipientHash: giftIntents.guestEmailHash,
      reference: giftIntents.publicReference,
      amountCents: giftIntents.appliedAmountCents,
      giftTitle: gifts.title
    })
    .from(giftIntents)
    .innerJoin(gifts, eq(gifts.id, giftIntents.giftId))
    .where(eq(giftIntents.id, input.intentId))
    .limit(1);
  const intent = rows[0];
  if (!intent) return;

  let guest: z.infer<typeof encryptedGuestSchema>;
  try {
    guest = encryptedGuestSchema.parse(
      JSON.parse(decryptSecret(intent.encryptedGuest, input.encryptionKey))
    );
  } catch {
    if (intent.recipientHash) {
      await recordDelivery(db, {
        intentId: input.intentId,
        recipientHash: intent.recipientHash,
        templateKey: "gift_verification",
        status: "failed",
        failureCode: "guest_details_unavailable"
      });
    }
    return;
  }

  await deliverTransactionalEmail(db, {
    intentId: input.intentId,
    recipient: guest.email,
    templateKey: "gift_verification",
    hashingSecret: input.hashingSecret,
    email: renderVerificationEmail({
      firstName: guest.firstName,
      giftName: intent.giftTitle,
      reference: intent.reference,
      amount: formatCurrency(intent.amountCents)
    })
  });
}
