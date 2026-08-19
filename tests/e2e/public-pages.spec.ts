import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("privacy page renders with a heading and no blocking a11y issues", async ({
    page
  }) => {
    await page.goto("/privacy");
    await page.addStyleTag({
      content:
        "*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}"
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(
      blocking,
      blocking.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });

  test("an invalid guest token yields a controlled response, not a crash", async ({
    page
  }) => {
    const response = await page.goto(
      "/richiesta/00000000-0000-0000-0000-000000000000"
    );
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});
