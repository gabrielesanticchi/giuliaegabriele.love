import { describe, expect, it } from "vitest";

import { hashAdminPassword, verifyAdminPassword } from "@/lib/auth/password";
import {
  AdminAuthorizationError,
  assertAdminPrincipal,
  validateAdminSession
} from "@/lib/auth/authorization";

describe("admin password", () => {
  it("stores strong passwords with Argon2id and verifies only the original", async () => {
    const digest = await hashAdminPassword("Pino!Verde-2026-lungo");

    expect(digest).toMatch(/^\$argon2id\$/);
    await expect(
      verifyAdminPassword("Pino!Verde-2026-lungo", digest)
    ).resolves.toBe(true);
    await expect(
      verifyAdminPassword("Pino!Verde-2026-errata", digest)
    ).resolves.toBe(false);
  });

  it("rejects only passwords shorter than 8 characters", async () => {
    await expect(hashAdminPassword("corta")).rejects.toThrow(/8 caratteri/);
    const digest = await hashAdminPassword("Password123!@");
    expect(digest).toMatch(/^\$argon2id\$/);
  });
});

describe("admin session authorization", () => {
  const activeAdmin = {
    id: "8f11c2bf-995a-4fc2-aaf8-f7539ccdf047",
    role: "owner" as const,
    sessionVersion: 4,
    isActive: true
  };

  it("accepts only a current active server-side session", async () => {
    await expect(
      validateAdminSession(
        { adminId: activeAdmin.id, role: "owner", sessionVersion: 4 },
        async () => activeAdmin
      )
    ).resolves.toEqual(activeAdmin);

    await expect(
      validateAdminSession(
        { adminId: activeAdmin.id, role: "owner", sessionVersion: 3 },
        async () => activeAdmin
      )
    ).resolves.toBeNull();
    await expect(
      validateAdminSession(
        { adminId: activeAdmin.id, role: "owner", sessionVersion: 4 },
        async () => ({ ...activeAdmin, isActive: false })
      )
    ).resolves.toBeNull();
  });

  it("rejects missing and insufficient-role principals", () => {
    expect(() => assertAdminPrincipal(null)).toThrow(AdminAuthorizationError);
    expect(() =>
      assertAdminPrincipal({ ...activeAdmin, role: "editor" }, "owner")
    ).toThrow("Permessi insufficienti");
  });
});
