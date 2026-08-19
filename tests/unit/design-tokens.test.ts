import { describe, expect, it } from "vitest";

import { contrastRatio, designTokens } from "@/styles/design-tokens";

describe("design tokens", () => {
  it("mantiene il testo clay leggibile sulle superfici chiare", () => {
    expect(
      contrastRatio(designTokens.clayText, designTokens.paper)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(designTokens.clayText, designTokens.ivory)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("mantiene il testo dedicato leggibile sul fondo clay", () => {
    expect(
      contrastRatio(designTokens.onClay, designTokens.clay)
    ).toBeGreaterThanOrEqual(4.5);
  });
});
