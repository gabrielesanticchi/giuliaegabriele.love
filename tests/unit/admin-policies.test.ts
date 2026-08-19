import { describe, expect, it } from "vitest";

import { assertSiteReady, getReadinessChecklist } from "@/lib/admin/readiness";
import { buildSafeCsv } from "@/lib/admin/csv";
import { redactAuditMetadata } from "@/lib/admin/audit";

describe("admin CSV export", () => {
  it("neutralizes spreadsheet formulas and excludes banking coordinates", () => {
    const csv = buildSafeCsv([
      {
        reference: '=HYPERLINK("https://evil.test")',
        guest: " \t+Mario",
        note: "-formula",
        status: "@pending",
        amountCents: 12_500,
        iban: "IT00BANKINGSECRET"
      }
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("' \t+Mario");
    expect(csv).toContain("'-formula");
    expect(csv).toContain("'@pending");
    expect(csv).not.toContain("iban");
    expect(csv).not.toContain("IT00BANKINGSECRET");
  });
});

describe("audit minimization", () => {
  it("recursively removes auth, banking and personal secrets", () => {
    expect(
      redactAuditMetadata({
        action: "updated",
        amountCents: 4_500,
        password: "secret",
        totpSecret: "secret",
        encryptedValue: "ciphertext",
        credentials: "secret",
        iban: "IT00",
        nested: { email: "guest@example.com", note: "nota consentita" }
      })
    ).toEqual({
      action: "updated",
      amountCents: 4_500,
      nested: { note: "nota consentita" }
    });
  });
});

describe("readiness and publishing", () => {
  const readyInput = {
    heroConfigured: true,
    heroPublished: true,
    weddingConfigured: true,
    weddingPublished: true,
    weddingDateConfigured: true,
    schedulePublishedCount: 2,
    storyPublishedCount: 1,
    dressColorCount: 3,
    dressPublished: true,
    publishedGiftCount: 1,
    bankingConfigured: true,
    requiredMediaReady: true,
    privacyReviewed: true
  };

  it("reports every missing requirement and blocks publishing", () => {
    const checklist = getReadinessChecklist({
      ...readyInput,
      schedulePublishedCount: 0,
      privacyReviewed: false
    });

    expect(
      checklist.filter((item) => !item.ready).map((item) => item.key)
    ).toEqual(["schedule", "privacy"]);
    expect(() => assertSiteReady(checklist)).toThrow(
      "Il sito non è pronto per la pubblicazione"
    );
  });

  it("allows publishing only when the complete checklist is ready", () => {
    expect(() =>
      assertSiteReady(getReadinessChecklist(readyInput))
    ).not.toThrow();
  });
});
