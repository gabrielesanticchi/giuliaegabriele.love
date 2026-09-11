import { describe, expect, it, vi } from "vitest";

import * as giftHandlers from "@/lib/public-api/gift-handler";

const body = {
  guest: {
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "+39 333 1234567",
    message: "Auguri!"
  },
  privacyAccepted: true,
  privacyVersion: "2026-09-11",
  honeypot: "",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  amountCents: 12_500
};

describe("registry contribution route", () => {
  it("creates a bank contribution without resolving a gift", async () => {
    const mutate = vi.fn(async (input: { beforeCommit?: () => Promise<void> }) => {
      await input.beforeCommit?.();
      return {
        id: "123e4567-e89b-42d3-a456-426614174002",
        publicReference: "REQ-FUND123",
        expiresAt: new Date("2026-09-13T12:00:00.000Z"),
        replayed: false
      };
    });
    const getGift = vi.fn();
    const dependencies = {
      siteOrigin: "https://giuliaegabriele.love",
      fingerprintSecret: "fingerprint-secret",
      guestTokenSecret: "guest-token-secret",
      consumeRateLimit: vi.fn().mockResolvedValue({
        allowed: true,
        remaining: 7,
        retryAfterSeconds: 0
      }),
      getGift,
      mutate,
      loadEncryptedBankInstructions: vi.fn().mockResolvedValue("encrypted"),
      decryptBankInstructions: vi.fn().mockReturnValue({
        accountHolder: "Intestatario configurato",
        iban: "IT00X0000000000000000000000"
      }),
      encryptGuestDetails: vi.fn().mockReturnValue("encrypted-guest-details"),
      notify: vi.fn().mockResolvedValue(undefined),
      now: () => new Date("2026-09-11T12:00:00.000Z")
    };
    const factory = (
      giftHandlers as unknown as Record<string, unknown>
    ).createRegistryContributionHandler;

    expect(factory).toBeTypeOf("function");
    if (typeof factory !== "function") return;

    const response = await factory(dependencies)(
      new Request("https://giuliaegabriele.love/api/registry/contribute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://giuliaegabriele.love",
          "x-forwarded-for": "203.0.113.8"
        },
        body: JSON.stringify(body)
      })
    );
    const result = (await response.json()) as {
      ok: boolean;
      instructions: { type: string; transferReason: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(result).toMatchObject({
      ok: true,
      instructions: {
        type: "bank_transfer",
        transferReason: "CASA-FONDOCASA-REQFUND123"
      }
    });
    expect(getGift).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 12_500 })
    );
  });
});
