import { describe, expect, it } from "vitest";

import {
  contributionRequestSchema,
  parseEuroAmountToCents,
  reserveGiftRequestSchema,
  requestActionSchema
} from "@/lib/public-api/validation";

const guest = {
  firstName: "  Ada  ",
  lastName: " Lovelace ",
  email: " ADA@example.com ",
  emailConfirmation: "ada@example.com",
  phone: " +39 333 1234567 ",
  message: " Un pensiero per voi "
};

const common = {
  guest,
  privacyAccepted: true as const,
  privacyVersion: "2026-08-19",
  turnstileToken: "test-token",
  honeypot: "",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000"
};

describe("public API validation", () => {
  it("converte importi decimali in centesimi senza arrotondare", () => {
    expect(parseEuroAmountToCents("12.34")).toBe(1234);
    expect(parseEuroAmountToCents("12,34")).toBe(1234);
    expect(parseEuroAmountToCents("12.345")).toBeNull();
    expect(parseEuroAmountToCents("1e2")).toBeNull();
    expect(parseEuroAmountToCents("0")).toBeNull();
  });

  it("normalizza il payload di prenotazione e verifica la conferma email", () => {
    const parsed = reserveGiftRequestSchema.parse({
      ...common,
      method: "bank_transfer"
    });

    expect(parsed.guest).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ADA@example.com",
      emailConfirmation: "ada@example.com",
      phone: "+39 333 1234567",
      message: "Un pensiero per voi"
    });
  });

  it("rifiuta email discordanti, privacy non accettata e campi oltre limite", () => {
    const parsed = reserveGiftRequestSchema.safeParse({
      ...common,
      guest: {
        ...guest,
        emailConfirmation: "altra@example.com",
        message: "x".repeat(501)
      },
      privacyAccepted: false,
      method: "external_purchase"
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining([
          "guest.emailConfirmation",
          "guest.message",
          "privacyAccepted"
        ])
      );
    }
  });

  it("accetta soltanto contributi in centesimi interi positivi", () => {
    expect(
      contributionRequestSchema.safeParse({ ...common, amountCents: 0 }).success
    ).toBe(false);
    expect(
      contributionRequestSchema.safeParse({ ...common, amountCents: 12.5 })
        .success
    ).toBe(false);
    expect(
      contributionRequestSchema.safeParse({ ...common, amountCents: 1250 })
        .success
    ).toBe(true);
  });

  it("limita anche il payload delle azioni sul link personale", () => {
    expect(
      requestActionSchema.safeParse({
        turnstileToken: "test-token",
        honeypot: "",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000"
      }).success
    ).toBe(true);
    expect(
      requestActionSchema.safeParse({
        turnstileToken: "",
        honeypot: "bot",
        idempotencyKey: "short"
      }).success
    ).toBe(false);
  });
});
