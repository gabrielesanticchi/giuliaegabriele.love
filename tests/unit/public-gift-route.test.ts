import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { TransactionError } from "@/db/transactions/errors";
import {
  createGiftIntentHandler,
  type GiftIntentHandlerDependencies,
  PublicServiceUnavailableError
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
    guestTokenSecret: "token-secret",
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
    mutate: vi.fn(async (input) => {
      await input.beforeCommit?.();
      return {
        id: "123e4567-e89b-42d3-a456-426614174002",
        publicReference: "REQ-ABC123",
        expiresAt: new Date("2026-08-21T12:00:00.000Z"),
        replayed: false
      };
    }),
    loadEncryptedBankInstructions: vi
      .fn()
      .mockResolvedValue("encrypted-bank-instructions"),
    decryptBankInstructions: vi.fn().mockReturnValue({
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

  it("accetta soltanto application/json con charset UTF-8 opzionale", async () => {
    const deps = dependencies();
    const handler = createGiftIntentHandler("reserve", deps);

    const accepted = await handler(
      post(requestBody, { "content-type": "application/json; charset=utf-8" }),
      { giftId }
    );
    const profiled = await handler(
      post(requestBody, {
        "content-type": "application/json; profile=https://example.test"
      }),
      { giftId }
    );
    const latin1 = await handler(
      post(requestBody, { "content-type": "application/json; charset=latin1" }),
      { giftId }
    );

    expect(accepted.status).toBe(200);
    expect(profiled.status).toBe(400);
    expect(latin1.status).toBe(400);
  });

  it("interrompe uno stream chunked oltre 16 KiB anche se content-length mente", async () => {
    const cancel = vi.fn();
    const chunks = [new Uint8Array(9_000), new Uint8Array(9_000)];
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel
    });
    const oversized = new Request(
      `https://giuliaegabriele.love/api/gifts/${giftId}/reserve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "12",
          origin: "https://giuliaegabriele.love"
        },
        body: stream,
        duplex: "half"
      } as RequestInit & { duplex: "half" }
    );
    const deps = dependencies();

    const response = await createGiftIntentHandler("reserve", deps)(oversized, {
      giftId
    });

    expect(response.status).toBe(400);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
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
    const events: string[] = [];
    const loadEncryptedBankInstructions = vi.fn(async () => {
      events.push("banking-query");
      return "encrypted-bank-instructions";
    });
    const deps = dependencies({
      mutate: vi.fn(async (input) => {
        events.push("mutation-started");
        await input.beforeCommit?.();
        events.push("mutation-committed");
        return {
          id: "123e4567-e89b-42d3-a456-426614174002",
          publicReference: "REQ-ABC123",
          expiresAt: new Date("2026-08-21T12:00:00.000Z"),
          replayed: false
        };
      }),
      decryptBankInstructions: vi.fn(() => {
        events.push("banking-decrypted");
        return {
          accountHolder: "Intestatario configurato",
          iban: "IT00X0000000000000000000000",
          bankName: "Banca configurata"
        };
      })
    });
    Object.assign(deps, { loadEncryptedBankInstructions });
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
      loadEncryptedBankInstructions.mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(deps.mutate).mock.invocationCallOrder[0] ?? 0);
    expect(events).toEqual([
      "banking-query",
      "mutation-started",
      "banking-decrypted",
      "mutation-committed"
    ]);
  });

  it("carica il blob bancario una volta prima della mutation e non interroga il pool in beforeCommit", async () => {
    const encryptedBankInstructions = "encrypted-bank-instructions";
    const events: string[] = [];
    let mutationRunning = false;
    const loadEncryptedBankInstructions = vi.fn(async () => {
      if (mutationRunning) throw new Error("query eseguita dentro la mutation");
      events.push("banking-query");
      return encryptedBankInstructions;
    });
    const decryptBankInstructions = vi.fn((encrypted: string) => {
      expect(encrypted).toBe(encryptedBankInstructions);
      events.push("banking-decrypted");
      return {
        accountHolder: "Intestatario configurato",
        iban: "IT00X0000000000000000000000",
        bankName: "Banca configurata"
      };
    });
    const deps = dependencies({
      mutate: vi.fn(async (input) => {
        mutationRunning = true;
        events.push("mutation-started");
        try {
          await input.beforeCommit?.();
          events.push("mutation-committed");
        } finally {
          mutationRunning = false;
        }
        return {
          id: "123e4567-e89b-42d3-a456-426614174002",
          publicReference: "REQ-ABC123",
          expiresAt: new Date("2026-08-21T12:00:00.000Z"),
          replayed: false
        };
      })
    });
    Object.assign(deps, {
      loadEncryptedBankInstructions,
      decryptBankInstructions
    });

    const response = await createGiftIntentHandler("reserve", deps)(post(), {
      giftId
    });

    expect(response.status).toBe(200);
    expect(loadEncryptedBankInstructions).toHaveBeenCalledTimes(1);
    expect(decryptBankInstructions).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      "banking-query",
      "mutation-started",
      "banking-decrypted",
      "mutation-committed"
    ]);
  });

  it("usa token casuali non derivabili dalla idempotency key", async () => {
    let mutationCount = 0;
    const deps = dependencies({
      mutate: vi.fn(async (input) => {
        await input.beforeCommit?.();
        mutationCount += 1;
        return mutationCount === 1
          ? {
              id: "123e4567-e89b-42d3-a456-426614174002",
              publicReference: "REQ-ABC123",
              expiresAt: new Date("2026-08-21T12:00:00.000Z"),
              replayed: false
            }
          : {
              id: "123e4567-e89b-42d3-a456-426614174003",
              publicReference: "REQ-DEF456",
              expiresAt: new Date("2026-08-21T12:00:00.000Z"),
              replayed: false
            };
      })
    });
    const handler = createGiftIntentHandler("reserve", deps);

    const first = (await (await handler(post(), { giftId })).json()) as {
      personalLink: string;
    };
    const secondRequest = {
      ...requestBody,
      idempotencyKey: "223e4567-e89b-42d3-a456-426614174000"
    };
    const second = (await (
      await handler(post(secondRequest), { giftId })
    ).json()) as {
      personalLink: string;
    };
    const deterministic = createHmac("sha256", "token-secret")
      .update(`guest-link\0${requestBody.idempotencyKey}`, "utf8")
      .digest("base64url");

    expect(first.personalLink).not.toBe(second.personalLink);
    expect(first.personalLink).not.toBe(`/richiesta/${deterministic}`);
  });

  it("su replay idempotente non ridivulga token o coordinate bancarie", async () => {
    const loadEncryptedBankInstructions = vi
      .fn()
      .mockResolvedValue("encrypted-bank-instructions");
    let mutationCount = 0;
    const deps = dependencies({
      mutate: vi.fn(async (input) => {
        mutationCount += 1;
        if (mutationCount === 1) await input.beforeCommit?.();
        return {
          id: "123e4567-e89b-42d3-a456-426614174002",
          publicReference: "REQ-ABC123",
          expiresAt: new Date("2026-08-21T12:00:00.000Z"),
          replayed: mutationCount > 1
        };
      })
    });
    Object.assign(deps, { loadEncryptedBankInstructions });
    const handler = createGiftIntentHandler("reserve", deps);

    const first = (await (await handler(post(), { giftId })).json()) as Record<
      string,
      unknown
    >;
    const replay = (await (await handler(post(), { giftId })).json()) as Record<
      string,
      unknown
    >;

    expect(first).toHaveProperty("personalLink");
    expect(first).toHaveProperty("instructions.iban");
    expect(replay).toEqual({
      ok: true,
      reference: "REQ-ABC123",
      giftStatus: "reserved",
      replayed: true
    });
    expect(loadEncryptedBankInstructions).toHaveBeenCalledTimes(2);
    expect(deps.decryptBankInstructions).toHaveBeenCalledTimes(1);
  });

  it("se la decifratura beforeCommit fallisce non conferma intent, token o email", async () => {
    const events: string[] = [];
    const deps = dependencies({
      mutate: vi.fn(async (input) => {
        events.push("mutation-started");
        try {
          await input.beforeCommit?.();
        } catch (error) {
          events.push("mutation-rolled-back");
          throw error;
        }
        events.push("mutation-committed");
        return {
          id: "123e4567-e89b-42d3-a456-426614174002",
          publicReference: "REQ-ABC123",
          expiresAt: new Date("2026-08-21T12:00:00.000Z"),
          replayed: false
        };
      }),
      decryptBankInstructions: vi.fn(() => {
        events.push("banking-invalid");
        throw new PublicServiceUnavailableError();
      })
    });

    const response = await createGiftIntentHandler("reserve", deps)(post(), {
      giftId
    });
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(events).toEqual([
      "mutation-started",
      "banking-invalid",
      "mutation-rolled-back"
    ]);
    expect(body).not.toContain("/richiesta/");
    expect(body).not.toContain("IT00");
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("fallisce chiuso in production senza un boundary proxy verificato", async () => {
    const deps = dependencies();
    Object.assign(deps, {
      clientIdentityPolicy: { production: true }
    });

    const response = await createGiftIntentHandler("reserve", deps)(
      post(requestBody, {
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "spoofable"
      }),
      { giftId }
    );

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("service_unavailable");
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(deps.mutate).not.toHaveBeenCalled();
  });

  it("fallisce chiuso in production se il trusted header manca o è malformato", async () => {
    const deps = dependencies();
    Object.assign(deps, {
      clientIdentityPolicy: {
        production: true,
        trustedProxyHeader: "x-vercel-forwarded-for"
      }
    });
    const handler = createGiftIntentHandler("reserve", deps);

    const missing = await handler(
      post(requestBody, { "x-vercel-forwarded-for": "" }),
      { giftId }
    );
    const malformed = await handler(
      post(requestBody, { "x-vercel-forwarded-for": "not-an-ip" }),
      { giftId }
    );

    expect(missing.status).toBe(503);
    expect(malformed.status).toBe(503);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("usa soltanto il trusted header configurato in production", async () => {
    const verifyTurnstile = vi.fn().mockResolvedValue({ success: true });
    const deps = dependencies({ verifyTurnstile });
    Object.assign(deps, {
      clientIdentityPolicy: {
        production: true,
        trustedProxyHeader: "x-vercel-forwarded-for"
      }
    });

    const response = await createGiftIntentHandler("reserve", deps)(
      post(requestBody, {
        "x-forwarded-for": "198.51.100.250",
        "x-vercel-forwarded-for": "203.0.113.42"
      }),
      { giftId }
    );

    expect(response.status).toBe(200);
    expect(verifyTurnstile).toHaveBeenCalledWith({
      token: "verified-token",
      remoteIp: "203.0.113.42"
    });
  });

  it("ignora x-forwarded-for fuori dal boundary Vercel", async () => {
    const consumeRateLimit = vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 7,
      retryAfterSeconds: 0
    });
    const verifyTurnstile = vi.fn().mockResolvedValue({ success: true });
    const deps = dependencies({ consumeRateLimit, verifyTurnstile });
    Object.assign(deps, {
      clientIdentityPolicy: { production: false }
    });
    const handler = createGiftIntentHandler("reserve", deps);

    await handler(post(requestBody, { "x-forwarded-for": "203.0.113.10" }), {
      giftId
    });
    await handler(post(requestBody, { "x-forwarded-for": "203.0.113.99" }), {
      giftId
    });
    await handler(
      post(requestBody, {
        "x-forwarded-for": "203.0.113.99",
        "user-agent": "different-client"
      }),
      { giftId }
    );

    expect(verifyTurnstile).toHaveBeenNthCalledWith(1, {
      token: "verified-token",
      remoteIp: undefined
    });
    expect(consumeRateLimit.mock.calls[0]?.[0].fingerprintHash).toBe(
      consumeRateLimit.mock.calls[1]?.[0].fingerprintHash
    );
    expect(consumeRateLimit.mock.calls[2]?.[0].fingerprintHash).not.toBe(
      consumeRateLimit.mock.calls[1]?.[0].fingerprintHash
    );
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
