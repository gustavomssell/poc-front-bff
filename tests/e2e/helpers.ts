import type { Locator, Page } from "@playwright/test";

export type PageIssues = {
  pageErrors: string[];
  consoleErrors: string[];
  failedResponses: string[];
};

/** Coleta exceções não tratadas, erros de console e respostas >= 400 do mesmo host. */
export function collectPageIssues(page: Page): PageIssues {
  const issues: PageIssues = {
    pageErrors: [],
    consoleErrors: [],
    failedResponses: [],
  };

  page.on("pageerror", (error) => {
    issues.pageErrors.push(String(error));
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url ?? "";
    if (source.includes("favicon")) return;
    issues.consoleErrors.push(message.text());
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;
    if (!response.url().includes("localhost")) return;
    issues.failedResponses.push(`${response.status()} ${response.url()}`);
  });

  return issues;
}

/** Card do screener ("Explorar a B3"). */
export function screenerCard(page: Page): Locator {
  return page.locator('[data-slot="card"]').filter({ hasText: "Explorar a B3" });
}

/** Card da watchlist. */
export function watchlistCard(page: Page): Locator {
  return page.locator('[data-slot="card"]').filter({ hasText: "Watchlist" });
}

/** Card do contrato BFF. */
export function contractCard(page: Page): Locator {
  return page.locator('[data-slot="card"]').filter({ hasText: "Contrato BFF" });
}

export type LayoutReport = {
  docOverflow: number;
  cutTables: string[];
};

/** Mede overflow horizontal do documento e de cada tabela (o <pre> do JSON rola por design). */
export function readLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const cutTables = Array.from(
      document.querySelectorAll('[data-slot="table-container"]'),
    )
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map(
        (el) =>
          `${(el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)} (${el.clientWidth}px < ${el.scrollWidth}px)`,
      );
    return { docOverflow: doc.scrollWidth - doc.clientWidth, cutTables };
  });
}
