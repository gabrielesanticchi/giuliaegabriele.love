import { expect, test } from "@playwright/test";

test.describe("admin access", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("protects the dashboard from unauthenticated access", async ({
    page
  }) => {
    const response = await page.goto("/admin");
    // Either a redirect to login or a non-200 guard — never the dashboard.
    await expect(page).not.toHaveURL(/\/admin$/);
    expect(response?.status()).toBeLessThan(500);
  });

  test("robots.txt disallows crawling during the noindex launch", async ({
    request
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBe(true);
    expect(await res.text()).toContain("Disallow: /");
  });

  test("health endpoint reports readiness", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.checks).toHaveProperty("database");
  });
});
