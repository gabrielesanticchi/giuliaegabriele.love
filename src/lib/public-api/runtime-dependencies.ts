import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { giftIntents, gifts, siteSettings } from "@/db/schema";
import {
  cancelIntent,
  contributeToGift,
  declareIntentPayment,
  reserveGift
} from "@/db/transactions";
import { deliverTransactionalEmail } from "@/lib/email";
import { renderAdminIntentEmail } from "@/lib/email/templates";
import { formatCurrency } from "@/lib/domain/currency";
import { decryptSecret } from "@/lib/security/crypto";
import { encryptSecret } from "@/lib/security/crypto";
import { consumeRateLimit } from "@/lib/security/rate-limit";

import {
  type BankInstructions,
  type GiftIntentHandlerDependencies,
  PublicServiceUnavailableError
} from "./gift-handler";
import type { RequestActionDependencies } from "./request-handler";

const bankInstructionsSchema = z.object({
  accountHolder: z.string().trim().min(1).max(200),
  iban: z.string().trim().min(15).max(34),
  bankName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(500).optional()
});

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PublicServiceUnavailableError();
  return value;
}

function publicConfig() {
  const siteOrigin = requiredEnvironment("NEXT_PUBLIC_SITE_URL");
  const fingerprintSecret = requiredEnvironment("REQUEST_FINGERPRINT_SECRET");
  const guestTokenSecret = requiredEnvironment("GUEST_TOKEN_SECRET");
  if (fingerprintSecret === guestTokenSecret) {
    throw new PublicServiceUnavailableError();
  }
  const explicitTrustedHeader = process.env.TRUSTED_PROXY_IP_HEADER?.trim();
  const trustedProxyHeader =
    process.env.VERCEL === "1"
      ? "x-vercel-forwarded-for"
      : explicitTrustedHeader || undefined;
  return {
    siteOrigin,
    fingerprintSecret,
    guestTokenSecret,
    clientIdentityPolicy: {
      production: process.env.NODE_ENV === "production",
      trustedProxyHeader
    }
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function encryptedBankInstructions(): Promise<string> {
  const db = getDatabase();
  const rows = await db
    .select({ encryptedValue: siteSettings.encryptedValue })
    .from(siteSettings)
    .where(eq(siteSettings.key, "banking_instructions"))
    .limit(1);
  const encrypted = rows[0]?.encryptedValue;
  if (!encrypted) throw new PublicServiceUnavailableError();
  return encrypted;
}

async function loadEncryptedBankInstructions(): Promise<string> {
  requiredEnvironment("DATA_ENCRYPTION_KEY");
  return encryptedBankInstructions();
}

function decryptBankInstructions(encrypted: string): BankInstructions {
  try {
    return bankInstructionsSchema.parse(
      JSON.parse(
        decryptSecret(encrypted, requiredEnvironment("DATA_ENCRYPTION_KEY"))
      )
    );
  } catch {
    throw new PublicServiceUnavailableError();
  }
}

export function createGiftRuntimeDependencies(
  kind: "reserve" | "contribute"
): GiftIntentHandlerDependencies {
  const config = publicConfig();
  const db = getDatabase();
  const limit = positiveInteger(process.env.PUBLIC_FORM_RATE_LIMIT, 8);
  const windowSeconds = positiveInteger(
    process.env.PUBLIC_FORM_RATE_WINDOW_SECONDS,
    900
  );
  const holdHours = positiveInteger(process.env.GIFT_HOLD_HOURS, 48);

  return {
    ...config,
    holdDurationMs: holdHours * 60 * 60 * 1_000,
    consumeRateLimit: (input) =>
      consumeRateLimit(db, {
        ...input,
        limit,
        windowMs: windowSeconds * 1_000
      }),
    getGift: async (giftId) => {
      const rows = await db
        .select({
          id: gifts.id,
          publicReference: gifts.publicReference,
          title: gifts.title,
          priceCents: gifts.priceCents
        })
        .from(gifts)
        .where(and(eq(gifts.id, giftId), eq(gifts.published, true)))
        .limit(1);
      return rows[0] ?? null;
    },
    mutate: ({ beforeCommit, ...input }) =>
      kind === "reserve"
        ? reserveGift(db, input, { beforeCommit })
        : contributeToGift(db, input, { beforeCommit }),
    loadEncryptedBankInstructions,
    decryptBankInstructions,
    encryptGuestDetails: (details) =>
      encryptSecret(
        JSON.stringify(details),
        requiredEnvironment("DATA_ENCRYPTION_KEY")
      ),
    notify: async (input) => {
      // Gli invitati forniscono solo il telefono: nessuna email di conferma al
      // guest. Resta la notifica agli sposi, se configurata.
      const siteOrigin = new URL(config.siteOrigin).origin;
      const admin = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
      if (admin) {
        await deliverTransactionalEmail(db, {
          intentId: input.intentId,
          recipient: admin,
          templateKey: "admin_gift_intent",
          email: renderAdminIntentEmail({
            giftName: input.gift.title,
            reference: input.reference,
            kind: kind === "reserve" ? "Prenotazione" : "Contributo",
            method:
              "method" in input.request
                ? input.request.method
                : "bank_transfer",
            guestName: `${input.request.guest.firstName} ${input.request.guest.lastName}`,
            amount: formatCurrency(
              "amountCents" in input.request
                ? input.request.amountCents
                : input.gift.priceCents
            ),
            createdAt: new Intl.DateTimeFormat("it-IT", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Europe/Rome"
            }).format(new Date()),
            adminUrl: new URL(
              `/admin/requests/${input.intentId}`,
              siteOrigin
            ).toString()
          }),
          hashingSecret: config.fingerprintSecret
        });
      }
    }
  };
}

export function createRequestRuntimeDependencies(): RequestActionDependencies {
  const config = publicConfig();
  const db = getDatabase();
  const limit = positiveInteger(process.env.PUBLIC_FORM_RATE_LIMIT, 8);
  const windowSeconds = positiveInteger(
    process.env.PUBLIC_FORM_RATE_WINDOW_SECONDS,
    900
  );
  return {
    ...config,
    consumeRateLimit: (input) =>
      consumeRateLimit(db, {
        ...input,
        limit,
        windowMs: windowSeconds * 1_000
      }),
    resolveIntent: async (tokenHash) => {
      const rows = await db
        .select({
          id: giftIntents.id,
          status: giftIntents.status,
          paymentDeclaredAt: giftIntents.paymentDeclaredAt,
          verifiedAt: giftIntents.verifiedAt,
          cancelledAt: giftIntents.cancelledAt,
          updatedAt: giftIntents.updatedAt
        })
        .from(giftIntents)
        .where(eq(giftIntents.guestTokenHash, tokenHash))
        .limit(1);
      const intent = rows[0];
      if (!intent) return null;
      const terminalAt =
        intent.status === "pending"
          ? null
          : (intent.verifiedAt ?? intent.cancelledAt ?? intent.updatedAt);
      return { ...intent, terminalAt };
    },
    complete: (intentId, idempotencyKey) =>
      declareIntentPayment(db, { intentId, idempotencyKey }),
    cancel: (intentId, idempotencyKey) =>
      cancelIntent(db, { intentId, actor: "guest", idempotencyKey }),
    notify: async () => undefined
  };
}
