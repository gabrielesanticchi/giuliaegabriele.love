import { describe, expect, it } from "vitest";

import { saveScheduleItemAction } from "@/actions/admin/content";
import { withAdminAuthDependencies } from "@/actions/admin/shared";
import {
  formatRomeDateTimeLocal,
  parseRomeDateTimeLocal
} from "@/lib/admin/datetime";
import type { AdminPrincipal } from "@/lib/auth/authorization";

describe("Europe/Rome datetime-local conversion", () => {
  it("preserves the wall clock across winter and summer offsets", () => {
    expect(parseRomeDateTimeLocal("2026-01-10T11:30").toISOString()).toBe(
      "2026-01-10T10:30:00.000Z"
    );
    expect(parseRomeDateTimeLocal("2026-07-10T11:30").toISOString()).toBe(
      "2026-07-10T09:30:00.000Z"
    );
    expect(formatRomeDateTimeLocal(new Date("2026-07-10T09:30:00.000Z"))).toBe(
      "2026-07-10T11:30"
    );
  });

  it("rejects the nonexistent spring-forward wall time", () => {
    expect(() => parseRomeDateTimeLocal("2026-03-29T02:30")).toThrow(
      "Ora locale non valida"
    );
  });

  it("chooses the earlier instant for an ambiguous fall-back wall time", () => {
    expect(parseRomeDateTimeLocal("2026-10-25T02:30").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z"
    );
  });
});

describe("saveScheduleItemAction datetime validation", () => {
  const principal: AdminPrincipal = {
    id: "11111111-1111-1111-1111-111111111111",
    role: "editor",
    sessionVersion: 1,
    isActive: true,
    totpPending: false
  };

  function scheduleForm(startsAt: string): FormData {
    const form = new FormData();
    form.set("title", "Cerimonia");
    form.set("startsAt", startsAt);
    form.set("sortOrder", "0");
    form.set("published", "true");
    return form;
  }

  const save = (startsAt: string) =>
    withAdminAuthDependencies({ getPrincipal: async () => principal }, () =>
      saveScheduleItemAction(scheduleForm(startsAt))
    );

  it("returns a controlled error for the nonexistent spring-forward gap", async () => {
    await expect(save("2026-03-29T02:30")).resolves.toEqual({
      ok: false,
      message: "Evento non valido"
    });
  });

  it("returns a controlled error for a malformed datetime", async () => {
    await expect(save("not-a-date")).resolves.toEqual({
      ok: false,
      message: "Evento non valido"
    });
  });
});
