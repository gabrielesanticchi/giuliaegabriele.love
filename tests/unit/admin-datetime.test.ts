import { describe, expect, it } from "vitest";

import {
  formatRomeDateTimeLocal,
  parseRomeDateTimeLocal
} from "@/lib/admin/datetime";

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
