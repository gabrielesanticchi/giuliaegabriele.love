import { describe, expect, it } from "vitest";

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
