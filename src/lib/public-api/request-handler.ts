import "server-only";

import { z } from "zod";

import { TransactionError } from "@/db/transactions/errors";
import { hashFingerprint, hashToken } from "@/lib/security/hashing";

import { PublicServiceUnavailableError, publicError } from "./gift-handler";
import {
  ClientIdentityUnavailableError,
  type ClientIdentityPolicy,
  resolveClientIdentity
} from "./client-identity";
import { readBoundedJson } from "./request-body";
import { requestActionSchema } from "./validation";

const TOKEN_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_BODY_BYTES = 16_384;
const guestTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

type GuestIntent = {
  id: string;
  status: "pending" | "verified" | "cancelled" | "expired" | "rejected";
  paymentDeclaredAt: Date | null;
  terminalAt: Date | null;
};

export type RequestActionDependencies = {
  siteOrigin: string;
  fingerprintSecret: string;
  guestTokenSecret: string;
  clientIdentityPolicy?: ClientIdentityPolicy;
  consumeRateLimit: (input: {
    fingerprintHash: string;
    bucketKey: string;
  }) => Promise<{
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  }>;
  resolveIntent: (tokenHash: string) => Promise<GuestIntent | null>;
  complete: (
    intentId: string,
    idempotencyKey: string
  ) => Promise<{
    status: string;
    paymentDeclaredAt: Date | null;
    replayed: boolean;
  }>;
  cancel: (
    intentId: string,
    idempotencyKey: string
  ) => Promise<{ status: string; replayed: boolean }>;
  notify: (intentId: string, action: "complete" | "cancel") => Promise<void>;
  now?: () => Date;
};

function headers(extra?: HeadersInit): Headers {
  const result = new Headers(extra);
  result.set("cache-control", "no-store");
  result.set("content-type", "application/json; charset=utf-8");
  return result;
}

function originAllowed(request: Request, siteOrigin: string): boolean {
  try {
    const supplied = request.headers.get("origin");
    return (
      supplied !== null &&
      new URL(supplied).origin === new URL(siteOrigin).origin
    );
  } catch {
    return false;
  }
}

function terminalTokenIsValid(intent: GuestIntent, now: Date): boolean {
  if (intent.status === "pending") return true;
  return (
    intent.terminalAt !== null &&
    now.getTime() - intent.terminalAt.getTime() <= TOKEN_RETENTION_MS
  );
}

function mapRequestError(error: unknown): Response {
  if (
    error instanceof ClientIdentityUnavailableError ||
    error instanceof PublicServiceUnavailableError
  ) {
    return publicError(503, "service_unavailable", { "retry-after": "60" });
  }
  if (error instanceof TransactionError) {
    if (
      error.code === "payment_already_declared" ||
      error.code === "intent_not_pending"
    ) {
      return new Response(
        JSON.stringify({
          error: {
            code: "duplicate_request",
            message: "La richiesta non può più essere annullata"
          }
        }),
        { status: 409, headers: headers() }
      );
    }
    return publicError(409, "retryable");
  }
  return publicError(500, "internal_error");
}

export function createRequestActionHandler(
  action: "complete" | "cancel",
  dependencies: RequestActionDependencies
) {
  return async (request: Request, context: { token: string }) => {
    try {
      if (!originAllowed(request, dependencies.siteOrigin)) {
        return publicError(403, "forbidden");
      }
      if (!guestTokenSchema.safeParse(context.token).success) {
        return publicError(403, "forbidden");
      }

      const body = await readBoundedJson(request, MAX_BODY_BYTES);
      if (!body.ok) return publicError(400, "invalid_request");
      const parsed = requestActionSchema.safeParse(body.value);
      if (!parsed.success) return publicError(422, "validation_failed");
      if (parsed.data.honeypot.trim() !== "") {
        return publicError(403, "forbidden");
      }
      if (!dependencies.fingerprintSecret || !dependencies.guestTokenSecret) {
        throw new PublicServiceUnavailableError();
      }

      const client = resolveClientIdentity(
        request,
        dependencies.clientIdentityPolicy ?? { production: false }
      );

      const fingerprintHash = hashFingerprint(
        client.fingerprintMaterial,
        dependencies.fingerprintSecret
      );
      const rateLimit = await dependencies.consumeRateLimit({
        fingerprintHash,
        bucketKey: `request:${action}`
      });
      if (!rateLimit.allowed) {
        return publicError(429, "rate_limited", {
          "retry-after": String(rateLimit.retryAfterSeconds)
        });
      }

      const intent = await dependencies.resolveIntent(
        hashToken(context.token, dependencies.guestTokenSecret)
      );
      const now = dependencies.now?.() ?? new Date();
      if (!intent || !terminalTokenIsValid(intent, now)) {
        return publicError(403, "forbidden");
      }

      const result =
        action === "complete"
          ? await dependencies.complete(intent.id, parsed.data.idempotencyKey)
          : await dependencies.cancel(intent.id, parsed.data.idempotencyKey);
      if (!result.replayed) {
        try {
          await dependencies.notify(intent.id, action);
        } catch {
          // Le notifiche non devono cambiare l'esito della mutation.
        }
      }

      const status =
        action === "complete" && "paymentDeclaredAt" in result
          ? "payment_declared"
          : "cancelled";
      return new Response(JSON.stringify({ ok: true, status }), {
        status: 200,
        headers: headers()
      });
    } catch (error) {
      return mapRequestError(error);
    }
  };
}
