import { describe, expect, it } from "vitest";

import { assertProductionEnv, REQUIRED_PRODUCTION_ENV } from "@/lib/config/env";

function completeEnv(): Record<string, string> {
  return Object.fromEntries(
    REQUIRED_PRODUCTION_ENV.map((name) => [name, `value-${name}`])
  );
}

describe("production environment validation", () => {
  it("passes when every required secret is present", () => {
    expect(() => assertProductionEnv(completeEnv())).not.toThrow();
  });

  it("fails closed listing every missing required variable", () => {
    const env = completeEnv();
    delete env.DATABASE_URL;
    delete env.AUTH_SECRET;
    expect(() => assertProductionEnv(env)).toThrow(/DATABASE_URL/);
    try {
      assertProductionEnv(env);
    } catch (error) {
      expect((error as Error).message).toContain("AUTH_SECRET");
    }
  });

  it("treats blank values as missing", () => {
    const env = completeEnv();
    env.DATA_ENCRYPTION_KEY = "   ";
    expect(() => assertProductionEnv(env)).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it("requires the security-critical secrets", () => {
    for (const name of [
      "DATABASE_URL",
      "AUTH_SECRET",
      "AUTH_ENCRYPTION_KEY",
      "DATA_ENCRYPTION_KEY",
      "GUEST_TOKEN_SECRET",
      "REQUEST_FINGERPRINT_SECRET"
    ]) {
      expect(REQUIRED_PRODUCTION_ENV).toContain(name);
    }
  });
});
