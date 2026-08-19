import { describe, expect, it } from "vitest";

import {
  ADMIN_ACTION_POLICIES,
  authorizeAdminAction
} from "@/lib/admin/action-policies";

describe("every admin action boundary", () => {
  it.each(Object.keys(ADMIN_ACTION_POLICIES))(
    "%s rejects an unauthenticated invocation",
    (action) => {
      expect(() => authorizeAdminAction(action, null)).toThrow(
        "Accesso amministratore richiesto"
      );
    }
  );

  it.each(
    Object.entries(ADMIN_ACTION_POLICIES)
      .filter(([, role]) => role === "owner")
      .map(([action]) => action)
  )("%s rejects an editor invocation", (action) => {
    expect(() =>
      authorizeAdminAction(action, {
        id: "8f11c2bf-995a-4fc2-aaf8-f7539ccdf047",
        role: "editor",
        sessionVersion: 1,
        isActive: true,
        totpPending: false
      })
    ).toThrow("Permessi insufficienti");
  });

  it("allows a TOTP-pending principal only through the enrollment boundary", () => {
    const pending = {
      id: "8f11c2bf-995a-4fc2-aaf8-f7539ccdf047",
      role: "owner" as const,
      sessionVersion: 1,
      isActive: true,
      totpPending: true
    };

    expect(() => authorizeAdminAction("totp.enroll", pending)).not.toThrow();
    expect(() => authorizeAdminAction("content.save", pending)).toThrow(
      "Configurazione TOTP richiesta"
    );
  });
});
