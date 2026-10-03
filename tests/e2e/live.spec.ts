import { expect, test } from "@playwright/test";

/**
 * Spec ao vivo: roda apenas com `E2E_LIVE=1` (ver README). Usa o mesmo
 * dev server, mas sem fixture upstream — os dados vêm das APIs reais
 * (brapi + BCB), sujeitas ao rate limit público de 20 req/min.
 */
test.describe("Smoke ao vivo (APIs reais)", () => {
  test.skip(!process.env.E2E_LIVE, "E2E_LIVE=1 para rodar contra as APIs reais");

  test("dashboard responde com dados reais vindos das APIs públicas", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Mercado B3", level: 1 }),
    ).toBeVisible();
    await expect(
      page.locator('section[aria-label="Indicadores do dia"]'),
    ).toBeVisible();
    await expect(
      page.locator('section[aria-label="Indicadores do dia"]').getByText("Selic"),
    ).toBeVisible();
    await expect(screenerRows(page)).toBeVisible();
  });
});

function screenerRows(page: import("@playwright/test").Page) {
  return page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Explorar a B3" })
    .locator("tbody tr")
    .first();
}
