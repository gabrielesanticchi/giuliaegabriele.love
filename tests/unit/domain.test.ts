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
  it("formatta i centesimi senza perdere la parte decimale", () => {
    expect(formatCurrency(16901)).toBe("169,01 €");
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
        priceCents: 90000,
        verifiedContributionCents: 35000,
        pendingContributionCents: 10000
      })
    ).toEqual({
      confirmedCents: 35000,
      pendingCents: 10000,
      remainingCents: 55000,
      committableCents: 45000,
      complete: false
    });
  });

  it.each([
    ["priceCents", -1],
    ["priceCents", 1.5],
    ["priceCents", Number.NaN],
    ["priceCents", Number.POSITIVE_INFINITY],
    ["priceCents", 9007199254740992],
    ["verifiedContributionCents", -1],
    ["verifiedContributionCents", 1.5],
    ["verifiedContributionCents", Number.NaN],
    ["verifiedContributionCents", Number.POSITIVE_INFINITY],
    ["verifiedContributionCents", 9007199254740992],
    ["pendingContributionCents", -1],
    ["pendingContributionCents", 1.5],
    ["pendingContributionCents", Number.NaN],
    ["pendingContributionCents", Number.POSITIVE_INFINITY],
    ["pendingContributionCents", 9007199254740992]
  ] as const)("rifiuta l'importo non valido %s=%s", (field, value) => {
    expect(() =>
      getGiftFunding({
        priceCents: 90000,
        verifiedContributionCents: 35000,
        pendingContributionCents: 10000,
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
