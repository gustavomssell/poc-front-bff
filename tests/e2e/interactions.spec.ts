import { expect, test } from "@playwright/test";
import { contractCard, screenerCard } from "./helpers";

test.describe("Interações do dashboard", () => {
  test("busca por ticker filtra o screener", async ({ page }) => {
    await page.goto("/");
    const card = screenerCard(page);
    await expect(card.locator("tbody tr").first()).toBeVisible();

    await card.getByLabel("Buscar ticker").fill("PETR4");
    const response = await page.waitForResponse(
      (r) => r.url().includes("/api/market") && r.url().includes("q=PETR4"),
      { timeout: 15_000 },
    );
    expect(response.status()).toBe(200);

    await expect(card.getByText(/resultados$/)).toBeVisible();
    await expect(card.locator("tbody tr").first()).toContainText("PETR4");
    expect(await card.locator("tbody tr").count()).toBeLessThanOrEqual(5);
  });

  test("estado vazio oferece limpar filtros e restaura a lista", async ({
    page,
  }) => {
    await page.goto("/");
    const card = screenerCard(page);
    await expect(card.locator("tbody tr").first()).toBeVisible();

    await card.getByLabel("Buscar ticker").fill("zzzzz-sigla-inexistente");
    await page.waitForResponse(
      (r) => r.url().includes("/api/market") && r.url().includes("q=zzzzz"),
      { timeout: 15_000 },
    );

    await expect(page.getByText("Nenhum ticker encontrado")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();

    await expect(card.getByLabel("Buscar ticker")).toHaveValue("");
    await expect(card.locator("tbody tr").first()).toBeVisible();
  });

  test("'Carregar mais' pagina o resultado", async ({ page }) => {
    await page.goto("/");
    const card = screenerCard(page);
    await expect(card.locator("tbody tr").first()).toBeVisible();

    const before = await card.locator("tbody tr").count();
    const nextPage = page.waitForResponse(
      (r) => r.url().includes("/api/market") && r.url().includes("page=2"),
      { timeout: 15_000 },
    );
    await card.getByRole("button", { name: "Carregar mais" }).click();
    expect((await nextPage).status()).toBe(200);

    await expect
      .poll(() => card.locator("tbody tr").count(), {
        message: "linhas devem ser acrescentadas",
      })
      .toBeGreaterThan(before);
  });

  test("trocar o período recarrega o histórico do gráfico", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".recharts-surface").first()).toBeVisible();

    const history = page.waitForResponse(
      (r) => r.url().includes("/api/history/") && r.url().includes("range=3m"),
      { timeout: 15_000 },
    );
    await page.getByLabel("3 meses").click();
    expect((await history).status()).toBe(200);
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
  });

  test("selecionar 2 ativos monta o painel de comparação", async ({ page }) => {
    await page.goto("/");
    const card = screenerCard(page);
    await expect(card.locator("tbody tr").first()).toBeVisible();

    const checkboxes = card.locator('[role="checkbox"]');
    await checkboxes.nth(0).check();
    await expect(
      card.getByText("selecionado(s) para comparação"),
    ).toBeVisible();

    const compare = page.waitForResponse(
      (r) => r.url().includes("/api/compare"),
      { timeout: 15_000 },
    );
    await checkboxes.nth(1).check();
    expect((await compare).status()).toBe(200);

    await expect(
      card.getByText("2 selecionado(s) para comparação"),
    ).toBeVisible();
  });

  test("'Repetir chamada' refaz o GET do contrato BFF", async ({ page }) => {
    await page.goto("/");
    const card = contractCard(page);
    await expect(card.getByText("HTTP 200")).toBeVisible();

    const dashboard = page.waitForResponse((r) =>
      r.url().endsWith("/api/dashboard"),
      { timeout: 15_000 },
    );
    await card.getByRole("button", { name: "Repetir chamada" }).click();
    expect((await dashboard).status()).toBe(200);

    await expect(card.getByText("HTTP 200")).toBeVisible();
  });
});
