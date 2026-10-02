import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { contractCard, screenerCard, watchlistCard } from "./helpers";

test.describe("Acessibilidade (axe-core)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`sem violações serious/critical — tema ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await expect(
        watchlistCard(page).locator("tbody tr").first(),
      ).toBeVisible();
      await expect(
        screenerCard(page).locator("tbody tr").first(),
      ).toBeVisible();
      await expect(page.locator(".recharts-surface").first()).toBeVisible();
      // page assentada: evita auditar controles ainda desabilitados no load
      await expect(contractCard(page).getByText("HTTP 200")).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      expect(
        serious.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    });
  }
});
