import { expect, test } from "@playwright/test";

const BREAKPOINTS = [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "desktop-1440x900", width: 1440, height: 900 }
] as const;

// Opt-in visual capture (not part of the assertion suite): run with
// CAPTURE_SCREENSHOTS=1 to write full-page PNGs under artifacts/screenshots.
const capture = process.env.CAPTURE_SCREENSHOTS === "1";

test.describe("visual QA screenshots", () => {
  test.skip(!capture, "set CAPTURE_SCREENSHOTS=1 to capture");

  for (const bp of BREAKPOINTS) {
    test(`home @ ${bp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { level: 1, name: "Giulia & Gabriele" })
      ).toBeVisible();
      await page.screenshot({
        path: `artifacts/screenshots/home-${bp.name}.png`,
        fullPage: true
      });
      // Guard against horizontal overflow at every breakpoint.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("admin login @ desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/login");
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await page.screenshot({
      path: "artifacts/screenshots/admin-login-1440x900.png",
      fullPage: true
    });
  });

  test("contribute dialog @ desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Contribuisci" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: "artifacts/screenshots/contribute-dialog-1440x900.png"
    });
  });
});
