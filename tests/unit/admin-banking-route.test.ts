import { afterEach, describe, expect, it, vi } from "vitest";

const { getBankingAction } = vi.hoisted(() => ({
  getBankingAction: vi.fn(async () => ({
    accountHolder: "G&G",
    iban: "IT00TEST"
  }))
}));
vi.mock("@/actions/admin/settings", () => ({ getBankingAction }));

import { POST } from "@/app/api/admin/banking/route";

describe("admin banking route boundary", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a missing or cross-origin POST before reading banking data", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    const response = await POST(
      new Request("https://example.test/api/admin/banking", {
        method: "POST",
        headers: { origin: "https://evil.test" }
      })
    );
    expect(response.status).toBe(403);
    expect(getBankingAction).not.toHaveBeenCalled();
  });

  it("delegates same-origin requests to the authenticated server action", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    const response = await POST(
      new Request("https://example.test/api/admin/banking", {
        method: "POST",
        headers: { origin: "https://example.test" }
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
