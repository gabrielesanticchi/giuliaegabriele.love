import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("gift registry", () => {
  test("filters are a toggle group with pressed state", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("group", { name: "Filtra i regali" });
    await expect(group).toBeVisible();
    const available = group.getByRole("button", { name: "Disponibili" });
    await available.click();
    await expect(available).toHaveAttribute("aria-pressed", "true");
  });

  test("contribute dialog is a modal that traps and restores focus", async ({
    page
  }) => {
    await page.goto("/");
    const invoker = page.getByRole("button", { name: "Contribuisci" }).first();
    await invoker.scrollIntoViewIfNeeded();
    await invoker.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Focus is moved into the dialog (onto the close control) on open.
    await expect(dialog.getByRole("button", { name: "Chiudi" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // Focus is restored to the invoking trigger on close.
    await expect(invoker).toBeFocused();
  });

  test("has no serious or critical a11y violations with the dialog open", async ({
    page
  }) => {
    await page.goto("/");
    // Snap CSS transitions so the scrolled header colour is measured settled,
    // not mid-transition.
    await page.addStyleTag({
      content:
        "*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}"
    });
    await page.getByRole("button", { name: "Contribuisci" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
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
