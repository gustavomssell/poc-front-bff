import { expect, test, type Page } from "@playwright/test";

const chartUp = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--chart-up").trim(),
  );

const storedTheme = (page: Page) =>
  page.evaluate(() => localStorage.getItem("theme"));

test.describe("Tema", () => {
  test("alterna sistema → claro → escuro e persiste o tema", async ({
    page,
  }) => {
    await page.goto("/");
    const html = page.locator("html");

    // padrão: tema "system" resolvido como light (colorScheme do navegador)
    await expect(page.getByRole("button", { name: /Tema sistema/ })).toBeVisible();
    await expect(html).toHaveClass(/light/);
    const lightVar = await chartUp(page);
    expect(lightVar).not.toBe("");

    await page.getByRole("button", { name: /Tema sistema/ }).click();
    await expect(page.getByRole("button", { name: /Tema claro/ })).toBeVisible();
    await expect(html).toHaveClass(/light/);
    expect(await storedTheme(page)).toBe("light");

    await page.getByRole("button", { name: /Tema claro/ }).click();
    await expect(page.getByRole("button", { name: /Tema escuro/ })).toBeVisible();
    await expect(html).toHaveClass(/dark/);
    expect(await storedTheme(page)).toBe("dark");
    const darkVar = await chartUp(page);
    expect(darkVar).not.toBe(lightVar);

    await page.reload();
    await expect(html).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: /Tema escuro/ })).toBeVisible();

    await page.getByRole("button", { name: /Tema escuro/ }).click();
    await expect(page.getByRole("button", { name: /Tema sistema/ })).toBeVisible();
    expect(await storedTheme(page)).toBe("system");
    await expect(html).toHaveClass(/light/);
  });

  test("respeita prefers-color-scheme quando o tema é 'sistema'", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await storedTheme(page)).toBeNull();
    expect(await chartUp(page)).not.toBe("");
  });
});
