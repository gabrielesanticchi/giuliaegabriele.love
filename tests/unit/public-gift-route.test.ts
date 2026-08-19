import { describe, expect, it, vi } from "vitest";

import { TransactionError } from "@/db/transactions/errors";
import {
  createGiftIntentHandler,
  type GiftIntentHandlerDependencies
} from "@/lib/public-api/gift-handler";

const giftId = "123e4567-e89b-42d3-a456-426614174001";
const requestBody = {
  guest: {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    emailConfirmation: "ada@example.com",
    phone: "",
    message: "Auguri!"
  },
  privacyAccepted: true,
  privacyVersion: "2026-08-19",
  turnstileToken: "verified-token",
  honeypot: "",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  method: "bank_transfer"
};

function post(
  body: unknown = requestBody,
  headers: Record<string, string> = {}
) {
  return new Request(
    `https://giuliaegabriele.love/api/gifts/${giftId}/reserve`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://giuliaegabriele.love",
        "x-forwarded-for": "203.0.113.7",
        ...headers
      },
      body: typeof body === "string" ? body : JSON.stringify(body)
    }
  );
}

function dependencies(
  overrides: Partial<GiftIntentHandlerDependencies> = {}
): GiftIntentHandlerDependencies {
  return {
    siteOrigin: "https://giuliaegabriele.love",
    fingerprintSecret: "fingerprint-secret",
    tokenSecret: "token-secret",
    verifyTurnstile: vi.fn().mockResolvedValue({ success: true }),
    consumeRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 7,
      retryAfterSeconds: 0
    }),
    getGift: vi.fn().mockResolvedValue({
      id: giftId,
      publicReference: "TAVOLO-01",
      title: "Tavolo per la cucina",
      priceCents: 120000
    }),
    mutate: vi.fn().mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174002",
      publicReference: "REQ-ABC123",
      expiresAt: new Date("2026-08-21T12:00:00.000Z")
    }),
    loadBankInstructions: vi.fn().mockResolvedValue({
      accountHolder: "Intestatario configurato",
      iban: "IT00X0000000000000000000000",
      bankName: "Banca configurata"
    }),
    encryptGuestDetails: vi.fn().mockReturnValue("encrypted-guest-details"),
    notify: vi.fn().mockResolvedValue(undefined),
    now: () => new Date("2026-08-19T12:00:00.000Z"),
    ...overrides
  };
}

async function errorCode(response: Response) {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

describe("public gift route", () => {
  it("rifiuta content type non JSON e body troppo grande prima delle dipendenze", async () => {
    const deps = dependencies();
    const handler = createGiftIntentHandler("reserve", deps);

    const wrongType = await handler(
      post(requestBody, { "content-type": "text/plain" }),
      { giftId }
    );
    const oversized = await handler(post("x".repeat(17_000)), { giftId });

    expect(wrongType.status).toBe(400);
    expect(await errorCode(wrongType)).toBe("invalid_request");
    expect(oversized.status).toBe(400);
    expect(await errorCode(oversized)).toBe("invalid_request");
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(deps.mutate).not.toHaveBeenCalled();
  });

  it("rifiuta origin estranea, validazione e honeypot prima del database", async () => {
    const deps = dependencies();
    const handler = createGiftIntentHandler("reserve", deps);

    const origin = await handler(
      post(requestBody, { origin: "https://evil.test" }),
      {
        giftId
      }
    );
    const invalid = await handler(
      post({ ...requestBody, guest: { ...requestBody.guest, firstName: "" } }),
      { giftId }
    );
    const bot = await handler(post({ ...requestBody, honeypot: "website" }), {
      giftId
    });

    expect(origin.status).toBe(403);
    expect(await errorCode(origin)).toBe("forbidden");
    expect(invalid.status).toBe(422);
    expect(await errorCode(invalid)).toBe("validation_failed");
    expect(bot.status).toBe(403);
    expect(await errorCode(bot)).toBe("forbidden");
    expect(deps.mutate).not.toHaveBeenCalled();
  });

  it("applica Turnstile e rate limit prima della mutation", async () => {
    const deniedTurnstile = dependencies({
      verifyTurnstile: vi.fn().mockResolvedValue({ success: false })
    });
    const turnstileResponse = await createGiftIntentHandler(
      "reserve",
      deniedTurnstile
    )(post(), { giftId });
    expect(turnstileResponse.status).toBe(403);
    expect(deniedTurnstile.consumeRateLimit).not.toHaveBeenCalled();

    const limited = dependencies({
      consumeRateLimit: vi.fn().mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 42
      })
    });
    const limitedResponse = await createGiftIntentHandler("reserve", limited)(
      post(),
      { giftId }
    );
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get("retry-after")).toBe("42");
    expect(limited.mutate).not.toHaveBeenCalled();
  });

  it("restituisce istruzioni soltanto nella mutation no-store e non passa IP grezzo al DB", async () => {
    const deps = dependencies();
    const handler = createGiftIntentHandler("reserve", deps);

    const response = await handler(post(), { giftId });
    const body = (await response.json()) as {
      ok: boolean;
      reference: string;
      personalLink: string;
      instructions: Record<string, string>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      ok: true,
      reference: "REQ-ABC123",
      personalLink: expect.stringMatching(/^\/richiesta\/[A-Za-z0-9_-]{43}$/),
      instructions: {
        type: "bank_transfer",
        accountHolder: "Intestatario configurato",
        iban: "IT00X0000000000000000000000",
        transferReason: "CASA-TAVOLO01-REQABC123"
      }
    });
    const mutationInput = vi.mocked(deps.mutate).mock.calls[0]?.[0];
    expect(mutationInput).not.toBeUndefined();
    expect(JSON.stringify(mutationInput)).not.toContain("203.0.113.7");
    expect(mutationInput?.fingerprintHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mutationInput?.guestTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mutationInput?.guestEmailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mutationInput).toHaveProperty(
      "guestDetailsEncrypted",
      "encrypted-guest-details"
    );
    expect(
      vi.mocked(deps.loadBankInstructions).mock.invocationCallOrder[0]
    ).toBeGreaterThan(vi.mocked(deps.mutate).mock.invocationCallOrder[0] ?? 0);
  });

  it("restituisce lo stesso link personale su retry idempotente", async () => {
    const deps = dependencies();
    const handler = createGiftIntentHandler("reserve", deps);

    const first = (await (await handler(post(), { giftId })).json()) as {
      personalLink: string;
    };
    const retry = (await (await handler(post(), { giftId })).json()) as {
      personalLink: string;
    };

    expect(retry.personalLink).toBe(first.personalLink);
  });

  it("mappa i conflitti e non espone errori interni", async () => {
    const unavailable = dependencies({
      mutate: vi
        .fn()
        .mockRejectedValue(new TransactionError("gift_unavailable"))
    });
    const conflict = await createGiftIntentHandler("reserve", unavailable)(
      post(),
      { giftId }
    );
    expect(conflict.status).toBe(409);
    expect(await errorCode(conflict)).toBe("gift_unavailable");

    const broken = dependencies({
      mutate: vi.fn().mockRejectedValue(new Error("relation gifts missing"))
    });
    const failure = await createGiftIntentHandler("reserve", broken)(post(), {
      giftId
    });
    expect(failure.status).toBe(500);
    expect(await failure.text()).not.toContain("relation gifts missing");
  });
});
