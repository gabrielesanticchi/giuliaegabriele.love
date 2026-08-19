import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("public home", () => {
  test("renders the editorial landing with one h1 and a skip link", async ({
    page
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Gabriele & Giulia" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Vai al contenuto principale" })
    ).toHaveAttribute("href", "#contenuto");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("keyboard focus reaches the skip link first", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Vai al contenuto principale" })
    ).toBeFocused();
  });

  test("has no serious or critical accessibility violations", async ({
    page
  }) => {
    await page.goto("/");
    await page.addStyleTag({
      content:
        "*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}"
    });
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
});
