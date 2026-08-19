import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";

import { TransactionError } from "@/db/transactions/errors";
import { buildTransferReason } from "@/lib/domain/references";
import { hashEmail, hashFingerprint, hashToken } from "@/lib/security/hashing";
import {
  TurnstileUnavailableError,
  type TurnstileDecision
} from "@/lib/turnstile";

import {
  contributionRequestSchema,
  reserveGiftRequestSchema,
  type ContributionRequest,
  type ReserveGiftRequest
} from "./validation";

const MAX_BODY_BYTES = 16_384;
const GIFT_HOLD_MS = 48 * 60 * 60 * 1_000;

export type PublicErrorCode =
  | "invalid_request"
  | "forbidden"
  | "gift_unavailable"
  | "amount_unavailable"
  | "duplicate_request"
  | "retryable"
  | "validation_failed"
  | "rate_limited"
  | "internal_error"
  | "service_unavailable";

export type MutationInput = {
  giftId: string;
  idempotencyKey: string;
  publicReference: string;
  method: "external_purchase" | "bank_transfer";
  amountCents: number;
  requestFingerprintHash: string;
  guestTokenHash: string;
  guestDetailsEncrypted: string;
  guestEmailHash: string;
  fingerprintHash: string;
  expiresAt: Date;
};

type MutationResult = {
  id: string;
  publicReference: string;
  expiresAt: Date;
};

type GiftForMutation = {
  id: string;
  publicReference: string;
  title: string;
  priceCents: number;
};

export type BankInstructions = {
  accountHolder: string;
  iban: string;
  bankName?: string;
  instructions?: string;
};

export type GiftIntentHandlerDependencies = {
  siteOrigin: string;
  fingerprintSecret: string;
  tokenSecret: string;
  verifyTurnstile: (input: {
    token: string;
    remoteIp?: string;
  }) => Promise<TurnstileDecision>;
  consumeRateLimit: (input: {
    fingerprintHash: string;
    bucketKey: string;
  }) => Promise<{
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  }>;
  getGift: (giftId: string) => Promise<GiftForMutation | null>;
  mutate: (input: MutationInput) => Promise<MutationResult>;
  loadBankInstructions: () => Promise<BankInstructions>;
  encryptGuestDetails: (details: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    message?: string;
    privacyVersion: string;
  }) => string;
  notify: (input: {
    intentId: string;
    reference: string;
    expiresAt: Date;
    gift: GiftForMutation;
    request: ReserveGiftRequest | ContributionRequest;
    instructions: Record<string, string | undefined>;
    personalLink: string;
  }) => Promise<void>;
  now?: () => Date;
  holdDurationMs?: number;
};

export class PublicServiceUnavailableError extends Error {
  constructor() {
    super("Servizio pubblico non configurato");
    this.name = "PublicServiceUnavailableError";
  }
}

function responseHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  return headers;
}

export function publicError(
  status: 400 | 403 | 409 | 422 | 429 | 500 | 503,
  code: PublicErrorCode,
  extraHeaders?: HeadersInit
): Response {
  return new Response(
    JSON.stringify({ error: { code, message: publicErrorMessage(code) } }),
    { status, headers: responseHeaders(extraHeaders) }
  );
}

function publicErrorMessage(code: PublicErrorCode): string {
  const messages: Record<PublicErrorCode, string> = {
    invalid_request: "Richiesta non valida",
    forbidden: "Richiesta non autorizzata",
    gift_unavailable: "Il regalo non è più disponibile",
    amount_unavailable: "L’importo non è più disponibile",
    duplicate_request: "La chiave è già associata a un’altra richiesta",
    retryable: "La richiesta può essere riprovata",
    validation_failed: "Controlla i dati inseriti",
    rate_limited: "Troppe richieste, riprova più tardi",
    internal_error: "Si è verificato un errore",
    service_unavailable: "Il servizio non è momentaneamente disponibile"
  };
  return messages[code];
}

function getRemoteIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function isAllowedOrigin(request: Request, siteOrigin: string): boolean {
  try {
    const expected = new URL(siteOrigin).origin;
    const supplied = request.headers.get("origin");
    return supplied !== null && new URL(supplied).origin === expected;
  } catch {
    return false;
  }
}

function deriveGuestToken(idempotencyKey: string, secret: string): string {
  if (!secret) throw new PublicServiceUnavailableError();
  return createHmac("sha256", secret)
    .update(`guest-link\0${idempotencyKey}`, "utf8")
    .digest("base64url");
}

function requestFingerprint(
  request: ReserveGiftRequest | ContributionRequest,
  giftId: string,
  secret: string
): string {
  const semanticPayload = JSON.stringify({
    giftId,
    firstName: request.guest.firstName,
    lastName: request.guest.lastName,
    email: request.guest.email.toLowerCase(),
    phone: request.guest.phone ?? null,
    message: request.guest.message ?? null,
    method: "method" in request ? request.method : "bank_transfer",
    amountCents: "amountCents" in request ? request.amountCents : undefined,
    privacyVersion: request.privacyVersion
  });
  return hashFingerprint(semanticPayload, secret);
}

function mapError(error: unknown): Response {
  if (
    error instanceof TurnstileUnavailableError ||
    error instanceof PublicServiceUnavailableError
  ) {
    return publicError(503, "service_unavailable", { "retry-after": "60" });
  }
  if (error instanceof TransactionError) {
    const allowed = [
      "gift_unavailable",
      "amount_unavailable",
      "duplicate_request",
      "retryable"
    ] as const;
    const code = allowed.find((value) => value === error.code) ?? "retryable";
    return publicError(409, code);
  }
  return publicError(500, "internal_error");
}

export function createGiftIntentHandler(
  kind: "reserve" | "contribute",
  dependencies: GiftIntentHandlerDependencies
) {
  return async (request: Request, context: { giftId: string }) => {
    try {
      if (
        !request.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("application/json")
      ) {
        return publicError(400, "invalid_request");
      }
      const declaredLength = Number(request.headers.get("content-length"));
      if (declaredLength > MAX_BODY_BYTES) {
        return publicError(400, "invalid_request");
      }
      if (!isAllowedOrigin(request, dependencies.siteOrigin)) {
        return publicError(403, "forbidden");
      }

      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return publicError(400, "invalid_request");
      }

      let untrusted: unknown;
      try {
        untrusted = JSON.parse(rawBody);
      } catch {
        return publicError(400, "invalid_request");
      }

      const giftId = z.uuid().safeParse(context.giftId);
      const parsed = (
        kind === "reserve"
          ? reserveGiftRequestSchema
          : contributionRequestSchema
      ).safeParse(untrusted);
      if (!giftId.success || !parsed.success) {
        return publicError(422, "validation_failed");
      }
      if (parsed.data.honeypot.trim() !== "") {
        return publicError(403, "forbidden");
      }

      const remoteIp = getRemoteIp(request);
      const turnstile = await dependencies.verifyTurnstile({
        token: parsed.data.turnstileToken,
        remoteIp
      });
      if (!turnstile.success) return publicError(403, "forbidden");

      if (!dependencies.fingerprintSecret || !dependencies.tokenSecret) {
        throw new PublicServiceUnavailableError();
      }
      const fingerprintHash = hashFingerprint(
        remoteIp,
        dependencies.fingerprintSecret
      );
      const rateLimit = await dependencies.consumeRateLimit({
        fingerprintHash,
        bucketKey: `gift:${kind}`
      });
      if (!rateLimit.allowed) {
        return publicError(429, "rate_limited", {
          "retry-after": String(rateLimit.retryAfterSeconds)
        });
      }

      const gift = await dependencies.getGift(giftId.data);
      if (!gift) return publicError(409, "gift_unavailable");

      const now = dependencies.now?.() ?? new Date();
      const guestToken = deriveGuestToken(
        parsed.data.idempotencyKey,
        dependencies.tokenSecret
      );
      const method =
        "method" in parsed.data ? parsed.data.method : "bank_transfer";
      const amountCents =
        "amountCents" in parsed.data
          ? parsed.data.amountCents
          : gift.priceCents;
      const intent = await dependencies.mutate({
        giftId: gift.id,
        idempotencyKey: parsed.data.idempotencyKey,
        publicReference: `REQ-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        method,
        amountCents,
        requestFingerprintHash: requestFingerprint(
          parsed.data,
          gift.id,
          dependencies.fingerprintSecret
        ),
        guestTokenHash: hashToken(guestToken, dependencies.tokenSecret),
        guestDetailsEncrypted: dependencies.encryptGuestDetails({
          firstName: parsed.data.guest.firstName,
          lastName: parsed.data.guest.lastName,
          email: parsed.data.guest.email,
          phone: parsed.data.guest.phone,
          message: parsed.data.guest.message,
          privacyVersion: parsed.data.privacyVersion
        }),
        guestEmailHash: hashEmail(
          parsed.data.guest.email,
          dependencies.fingerprintSecret
        ),
        fingerprintHash,
        expiresAt: new Date(
          now.getTime() + (dependencies.holdDurationMs ?? GIFT_HOLD_MS)
        )
      });

      const personalLink = `/richiesta/${guestToken}`;
      let instructions: Record<string, string | undefined> = { type: method };
      if (method === "bank_transfer") {
        const bank = await dependencies.loadBankInstructions();
        instructions = {
          type: method,
          ...bank,
          transferReason: buildTransferReason(
            gift.publicReference,
            intent.publicReference
          )
        };
      }

      try {
        await dependencies.notify({
          intentId: intent.id,
          reference: intent.publicReference,
          expiresAt: intent.expiresAt,
          gift,
          request: parsed.data,
          instructions,
          personalLink
        });
      } catch {
        // Le notifiche sono best-effort e non modificano l'esito persistito.
      }

      return new Response(
        JSON.stringify({
          ok: true,
          reference: intent.publicReference,
          giftStatus: kind === "reserve" ? "reserved" : "available",
          expiresAt: intent.expiresAt.toISOString(),
          instructions,
          personalLink
        }),
        { status: 200, headers: responseHeaders() }
      );
    } catch (error) {
      return mapError(error);
    }
  };
}
