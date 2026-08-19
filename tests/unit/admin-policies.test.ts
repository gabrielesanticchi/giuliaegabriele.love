import { describe, expect, it, vi } from "vitest";

import { assertSiteReady, getReadinessChecklist } from "@/lib/admin/readiness";
import { buildSafeCsv } from "@/lib/admin/csv";
import { redactAuditMetadata } from "@/lib/admin/audit";
import { runIdempotentAdminMutation } from "@/lib/admin/idempotency";

describe("admin CSV export", () => {
  it("neutralizes spreadsheet formulas and excludes banking coordinates", () => {
    const csv = buildSafeCsv([
      {
        reference: '=HYPERLINK("https://evil.test")',
        guest: "+Mario",
        note: "-formula",
        status: "@pending",
        amountCents: 12_500,
        iban: "IT00BANKINGSECRET"
      }
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+Mario");
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
    weddingConfigured: true,
    schedulePublishedCount: 2,
    storyPublishedCount: 1,
    dressColorCount: 3,
    publishedGiftCount: 1,
    bankingConfigured: true,
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

describe("idempotent admin mutations", () => {
  it("returns the prior result and does not repeat the side effect", async () => {
    const effect = vi.fn(async () => ({ status: "verified" as const }));
    const store = new Map<string, unknown>();
    const dependencies = {
      load: async (key: string) => store.get(key),
      commit: async (key: string, result: unknown) => {
        store.set(key, result);
      }
    };

    const first = await runIdempotentAdminMutation(
      "verify:intent-1:key-1",
      effect,
      dependencies
    );
    const replay = await runIdempotentAdminMutation(
      "verify:intent-1:key-1",
      effect,
      dependencies
    );

    expect(first).toEqual({ result: { status: "verified" }, replayed: false });
    expect(replay).toEqual({ result: { status: "verified" }, replayed: true });
    expect(effect).toHaveBeenCalledTimes(1);
  });
});
