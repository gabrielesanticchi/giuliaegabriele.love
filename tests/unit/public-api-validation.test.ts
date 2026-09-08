import { describe, expect, it } from "vitest";

import {
  contributionRequestSchema,
  parseEuroAmount,
  reserveGiftRequestSchema,
  requestActionSchema
} from "@/lib/public-api/validation";

const guest = {
  firstName: "  Ada  ",
  lastName: " Lovelace ",
  phone: " +39 333 1234567 ",
  message: " Un pensiero per voi "
};

const common = {
  guest,
  privacyAccepted: true as const,
  privacyVersion: "2026-08-19",
  honeypot: "",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000"
};

describe("public API validation", () => {
  it("converte importi in euro con al massimo due decimali in centesimi", () => {
    expect(parseEuroAmount("50")).toBe(5000);
    expect(parseEuroAmount("169,01")).toBe(16901);
    expect(parseEuroAmount("12.34")).toBe(1234);
    expect(parseEuroAmount("12,345")).toBeNull();
    expect(parseEuroAmount("1e2")).toBeNull();
    expect(parseEuroAmount("0")).toBeNull();
  });

  it("normalizza il payload di prenotazione con solo nome e telefono", () => {
    const parsed = reserveGiftRequestSchema.parse({
      ...common,
      method: "bank_transfer"
    });

    expect(parsed.guest).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+39 333 1234567",
      message: "Un pensiero per voi"
    });
  });

  it("richiede il telefono e rifiuta privacy non accettata e campi oltre limite", () => {
    const parsed = reserveGiftRequestSchema.safeParse({
      ...common,
      guest: {
        firstName: "Ada",
        lastName: "Lovelace",
        phone: "",
        message: "x".repeat(501)
      },
      privacyAccepted: false,
      method: "external_purchase"
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining([
          "guest.phone",
          "guest.message",
          "privacyAccepted"
        ])
      );
    }
  });

  it("non accetta un campo email residuo (schema strict)", () => {
    const parsed = reserveGiftRequestSchema.safeParse({
      ...common,
      guest: { ...guest, email: "ada@example.com" },
      method: "bank_transfer"
    });
    expect(parsed.success).toBe(false);
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
        honeypot: "",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000"
      }).success
    ).toBe(true);
    expect(
      requestActionSchema.safeParse({
        honeypot: "bot",
        idempotencyKey: "short"
      }).success
    ).toBe(false);
  });
});
