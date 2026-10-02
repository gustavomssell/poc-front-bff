import { expect, test } from "@playwright/test";
import {
  collectPageIssues,
  contractCard,
  readLayout,
  screenerCard,
  watchlistCard,
} from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("Smoke", () => {
  test("renderiza as seções principais sem erros de console", async ({
    page,
  }) => {
    const issues = collectPageIssues(page);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Mercado B3", level: 1 }),
    ).toBeVisible();
    await expect(
      page.locator('section[aria-label="Indicadores do dia"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Maiores movimentos" }),
    ).toBeVisible();
    await expect(watchlistCard(page)).toBeVisible();
    await expect(screenerCard(page)).toBeVisible();
    await expect(contractCard(page)).toBeVisible();

    await expect(
      watchlistCard(page).locator("tbody tr").first(),
    ).toBeVisible();
    await expect(screenerCard(page).locator("tbody tr").first()).toBeVisible();
    await expect(contractCard(page).getByText("HTTP 200")).toBeVisible();

    expect(issues.pageErrors).toEqual([]);
    expect(issues.consoleErrors).toEqual([]);
    expect(issues.failedResponses).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`sem overflow horizontal — ${vp.name} (${vp.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      await expect(
        watchlistCard(page).locator("tbody tr").first(),
      ).toBeVisible();
      await expect(
        screenerCard(page).locator("tbody tr").first(),
      ).toBeVisible();
      await expect(
        screenerCard(page).getByText(/resultados$/),
      ).toBeVisible();

      const report = await readLayout(page);
      expect(report.docOverflow, "documento com scroll horizontal").toBeLessThanOrEqual(1);
      expect(report.cutTables, "tabelas cortadas").toEqual([]);
    });
  }

  test("header dos cards empilha no mobile sem esmagar o título", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const header = page
      .locator('[data-slot="card-header"]')
      .filter({ hasText: "Contrato BFF" })
      .first();
    await expect(header).toBeVisible();

    const gridCols = await header.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns,
    );
    expect(gridCols.split(" ").filter(Boolean).length).toBe(1);

    const titleBox = await header
      .locator('[data-slot="card-title"]')
      .boundingBox();
    const actionBox = await header
      .locator('[data-slot="card-action"]')
      .boundingBox();
    expect(titleBox!.width).toBeGreaterThan(250);
    expect(actionBox!.y).toBeGreaterThanOrEqual(
      titleBox!.y + titleBox!.height - 1,
    );
  });
});
