import { describe, expect, it } from "vitest";

import { getCountdown } from "@/lib/domain/countdown";
import { formatCurrency } from "@/lib/domain/currency";
import { getGiftFunding, getPublicGiftStatus } from "@/lib/domain/gifts";
import { buildTransferReason } from "@/lib/domain/references";
import {
  emailSchema,
  httpsUrlSchema,
  optionalEmailSchema
} from "@/lib/domain/schemas";
import { isSafeExternalUrl } from "@/lib/domain/urls";

describe("formatCurrency", () => {
  it("formatta gli importi in euro interi italiani", () => {
    expect(formatCurrency(50)).toBe("50 €");
  });
});

describe("getCountdown", () => {
  it("non inventa un countdown quando la data manca", () => {
    expect(getCountdown(null, new Date("2026-01-01T00:00:00Z"))).toEqual({
      phase: "missing"
    });
  });

  it("calcola una data futura senza valori negativi", () => {
    expect(
      getCountdown(
        "2026-10-24T11:00:00+02:00",
        new Date("2026-10-23T09:00:00Z")
      )
    ).toEqual({ phase: "before", days: 1, hours: 0, minutes: 0, seconds: 0 });
  });

  it("riconosce il giorno del matrimonio nel fuso di Roma", () => {
    expect(
      getCountdown(
        "2026-10-24T11:00:00+02:00",
        new Date("2026-10-24T12:00:00Z")
      )
    ).toEqual({ phase: "today" });
  });

  it("riconosce una data trascorsa", () => {
    expect(
      getCountdown(
        "2026-10-24T11:00:00+02:00",
        new Date("2026-10-25T00:00:00Z")
      )
    ).toEqual({ phase: "after" });
  });
});

describe("gift domain", () => {
  it("rende disponibile un regalo incompleto e senza lock", () => {
    expect(
      getPublicGiftStatus({ completed: false, hasFullGiftLock: false })
    ).toBe("available");
  });

  it("mappa un lock attivo sullo stato pubblico riservato", () => {
    expect(
      getPublicGiftStatus({ completed: false, hasFullGiftLock: true })
    ).toBe("reserved");
  });

  it("rende regalato un regalo completato", () => {
    expect(
      getPublicGiftStatus({ completed: true, hasFullGiftLock: false })
    ).toBe("gifted");
  });

  it("dà precedenza al completamento rispetto a un lock attivo", () => {
    expect(
      getPublicGiftStatus({ completed: true, hasFullGiftLock: true })
    ).toBe("gifted");
  });

  it("calcola confermato, pending e residuo impegnabile in euro", () => {
    expect(
      getGiftFunding({
        priceEuros: 90000,
        verifiedContributionEuros: 35000,
        pendingContributionEuros: 10000
      })
    ).toEqual({
      confirmedEuros: 35000,
      pendingEuros: 10000,
      remainingEuros: 55000,
      committableEuros: 45000,
      complete: false
    });
  });

  it.each([
    ["priceEuros", -1],
    ["priceEuros", 1.5],
    ["priceEuros", Number.NaN],
    ["priceEuros", Number.POSITIVE_INFINITY],
    ["priceEuros", 9007199254740992],
    ["verifiedContributionEuros", -1],
    ["verifiedContributionEuros", 1.5],
    ["verifiedContributionEuros", Number.NaN],
    ["verifiedContributionEuros", Number.POSITIVE_INFINITY],
    ["verifiedContributionEuros", 9007199254740992],
    ["pendingContributionEuros", -1],
    ["pendingContributionEuros", 1.5],
    ["pendingContributionEuros", Number.NaN],
    ["pendingContributionEuros", Number.POSITIVE_INFINITY],
    ["pendingContributionEuros", 9007199254740992]
  ] as const)("rifiuta l'importo non valido %s=%s", (field, value) => {
    expect(() =>
      getGiftFunding({
        priceEuros: 90000,
        verifiedContributionEuros: 35000,
        pendingContributionEuros: 10000,
        [field]: value
      })
    ).toThrow(TypeError);
  });
});

describe("buildTransferReason", () => {
  it("genera una causale stabile e priva di spazi", () => {
    expect(buildTransferReason("LIBRERIA", "AB12CD34")).toBe(
      "CASA-LIBRERIA-AB12CD34"
    );
  });
});

describe("isSafeExternalUrl", () => {
  it.each([
    ["https://maps.google.com/?q=Villa+Cavenago", true],
    ["http://example.com", false],
    ["javascript:alert(1)", false],
    ["not-a-url", false]
  ])("valida %s", (value, expected) => {
    expect(isSafeExternalUrl(value)).toBe(expected);
  });
});

describe("shared domain schemas", () => {
  it("normalizza e valida un indirizzo email", () => {
    expect(emailSchema.parse("  invitata@example.com ")).toBe(
      "invitata@example.com"
    );
    expect(emailSchema.safeParse("invitata.example.com").success).toBe(false);
  });

  it("tratta un'email vuota opzionale come assente", () => {
    expect(optionalEmailSchema.parse("   ")).toBeUndefined();
  });

  it("accetta soltanto URL HTTPS assoluti", () => {
    expect(
      httpsUrlSchema.parse("https://maps.google.com/?q=Villa+Cavenago")
    ).toBe("https://maps.google.com/?q=Villa+Cavenago");
    expect(httpsUrlSchema.safeParse("http://example.com").success).toBe(false);
    expect(httpsUrlSchema.safeParse("/privacy").success).toBe(false);
  });
});
