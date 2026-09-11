import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("gift registry", () => {
  test("places the common contribution as the last gift card", async ({
    page
  }) => {
    await page.goto("/");

    const cards = page
      .getByRole("group", { name: "Lista dei regali" })
      .getByRole("article");
    await expect(cards.last()).toContainText(
      "Se preferisci fare un’offerta libera"
    );
    await expect(
      cards.last().getByRole("button", { name: "Contribuisci" })
    ).toBeVisible();
  });

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

  test("centers the contribute dialog inside the desktop viewport", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000/");
    await page.addStyleTag({
      content: "*,*::before,*::after{animation-duration:0s!important}"
    });
    const invoker = page.getByRole("button", { name: "Contribuisci" }).first();
    await invoker.scrollIntoViewIfNeeded();
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      await invoker.click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass();

    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - 720)).toBeLessThanOrEqual(
      2
    );
    expect(Math.abs(bounds!.y + bounds!.height / 2 - 450)).toBeLessThanOrEqual(
      2
    );
    expect(bounds!.x).toBeGreaterThanOrEqual(32);
    expect(bounds!.y).toBeGreaterThanOrEqual(32);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1408);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(868);
  });

  test("returns the dialog to the top after a request is registered", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/api/registry/contribute", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          reference: "REQ-1",
          expiresAt: "2026-08-21T12:00:00.000Z",
          personalLink: "/richiesta/token",
          instructions: {
            type: "bank_transfer",
            accountHolder: "Persona A & Persona B",
            iban: "IT00X0000000000000000000000",
            bankName: "Banca di prova",
            instructions:
              'Suggeriamo di usare una causale chiara, es. "Regalo di nozze – liberalità"'
          }
        })
      });
    });
    await page.goto("http://localhost:3000/");
    const invoker = page.getByRole("button", { name: "Contribuisci" }).first();
    await invoker.scrollIntoViewIfNeeded();
    await invoker.click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome", { exact: true }).fill("Ada");
    await dialog.getByLabel("Cognome").fill("Lovelace");
    await dialog.getByLabel("Telefono").fill("+39 333 1234567");
    await dialog.getByLabel("Importo in euro").fill("50");
    await dialog.getByRole("checkbox", { name: /Ho letto e accetto/ }).check();
    await dialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await dialog.getByRole("button", { name: "Continua" }).click();

    await expect(dialog.getByRole("status")).toContainText(
      "Richiesta registrata"
    );
    await expect
      .poll(() => dialog.evaluate((element) => element.scrollTop))
      .toBe(0);
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
