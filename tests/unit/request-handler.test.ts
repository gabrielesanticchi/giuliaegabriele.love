import { describe, expect, it, vi } from "vitest";

import { TransactionError } from "@/db/transactions/errors";
import {
  createRequestActionHandler,
  type RequestActionDependencies
} from "@/lib/public-api/request-handler";

const token = "a".repeat(43);
const body = {
  turnstileToken: "verified-token",
  honeypot: "",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000"
};

function request(
  payload: unknown = body,
  origin = "https://giuliaegabriele.love",
  headers: Record<string, string> = {}
) {
  return new Request(
    `https://giuliaegabriele.love/api/requests/${token}/complete`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        "x-forwarded-for": "198.51.100.4",
        ...headers
      },
      body: JSON.stringify(payload)
    }
  );
}

function dependencies(
  overrides: Partial<RequestActionDependencies> = {}
): RequestActionDependencies {
  return {
    siteOrigin: "https://giuliaegabriele.love",
    fingerprintSecret: "fingerprint-secret",
    guestTokenSecret: "token-secret",
    verifyTurnstile: vi.fn().mockResolvedValue({ success: true }),
    consumeRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 7,
      retryAfterSeconds: 0
    }),
    resolveIntent: vi.fn().mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174002",
      status: "pending",
      paymentDeclaredAt: null,
      terminalAt: null
    }),
    complete: vi.fn().mockResolvedValue({
      status: "pending",
      paymentDeclaredAt: new Date("2026-08-19T12:00:00.000Z"),
      replayed: false
    }),
    cancel: vi.fn().mockResolvedValue({ status: "cancelled", replayed: false }),
    notify: vi.fn().mockResolvedValue(undefined),
    now: () => new Date("2026-08-19T12:00:00.000Z"),
    ...overrides
  };
}

describe("personal request action route", () => {
  it("dichiara il pagamento con token hash e risposta no-store", async () => {
    const deps = dependencies();
    const response = await createRequestActionHandler("complete", deps)(
      request(),
      { token }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      status: "payment_declared"
    });
    expect(deps.resolveIntent).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(deps.complete).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174002",
      body.idempotencyKey
    );
    expect(JSON.stringify(vi.mocked(deps.complete).mock.calls)).not.toContain(
      token
    );
  });

  it("annulla una pending e propaga il conflitto dopo dichiarazione", async () => {
    const deps = dependencies();
    const cancelled = await createRequestActionHandler("cancel", deps)(
      request(),
      { token }
    );
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toEqual({ ok: true, status: "cancelled" });

    const declared = dependencies({
      cancel: vi
        .fn()
        .mockRejectedValue(new TransactionError("payment_already_declared"))
    });
    const conflict = await createRequestActionHandler("cancel", declared)(
      request(),
      { token }
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      error: {
        code: "duplicate_request",
        message: "La richiesta non può più essere annullata"
      }
    });
  });

  it("rifiuta token malformati o revocati prima della mutation", async () => {
    const deps = dependencies({
      resolveIntent: vi.fn().mockResolvedValue(null)
    });
    const malformed = await createRequestActionHandler("complete", deps)(
      request(),
      { token: "short" }
    );
    const unknown = await createRequestActionHandler("complete", deps)(
      request(),
      {
        token
      }
    );

    expect(malformed.status).toBe(403);
    expect(unknown.status).toBe(403);
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("non ripete la notifica quando la action key è già stata applicata", async () => {
    const deps = dependencies({
      complete: vi.fn().mockResolvedValue({
        status: "pending",
        paymentDeclaredAt: new Date("2026-08-19T12:00:00.000Z"),
        replayed: true
      })
    });

    const response = await createRequestActionHandler("complete", deps)(
      request(),
      { token }
    );

    expect(response.status).toBe(200);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("revoca i token terminali oltre trenta giorni", async () => {
    const deps = dependencies({
      resolveIntent: vi.fn().mockResolvedValue({
        id: "123e4567-e89b-42d3-a456-426614174002",
        status: "cancelled",
        paymentDeclaredAt: null,
        terminalAt: new Date("2026-07-01T12:00:00.000Z")
      })
    });
    const response = await createRequestActionHandler("cancel", deps)(
      request(),
      {
        token
      }
    );

    expect(response.status).toBe(403);
    expect(deps.cancel).not.toHaveBeenCalled();
  });

  it("rifiuta media type estesi e body chunked oltre limite cancellando lo stream", async () => {
    const deps = dependencies();
    const wrongType = await createRequestActionHandler("complete", deps)(
      request(body, "https://giuliaegabriele.love", {
        "content-type": "application/problem+json"
      }),
      { token }
    );
    const cancel = vi.fn();
    const chunks = [new Uint8Array(10_000), new Uint8Array(7_000)];
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel
    });
    const chunked = new Request(
      `https://giuliaegabriele.love/api/requests/${token}/complete`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "10",
          origin: "https://giuliaegabriele.love"
        },
        body: stream,
        duplex: "half"
      } as RequestInit & { duplex: "half" }
    );
    const oversized = await createRequestActionHandler("complete", deps)(
      chunked,
      { token }
    );

    expect(wrongType.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(deps.complete).not.toHaveBeenCalled();
  });
});
