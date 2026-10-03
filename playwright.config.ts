import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3001);
const FIXTURE_PORT = Number(process.env.UPSTREAM_PORT ?? 4100);
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E hermético por padrão: o upstream-fixture.mjs emula brapi + BCB e o
 * dev server recebe BRAPI_BASE_URL/BCB_SGS_BASE_URL apontando para ele,
 * cobrindo tanto as chamadas server-side (SSR) quanto as do cliente.
 *
 * `E2E_LIVE=1` roda o mesmo suíte contra as APIs reais (requer rede e
 * respeita o rate limit público de 20 req/min).
 */
const live = process.env.E2E_LIVE === "1";

const serverEnv: Record<string, string> = {
  ...process.env,
  BRAPI_API_KEY: "",
  BRAPI_WATCHLIST: "",
  BFF_RATE_LIMIT_MAX: "1000",
  ...(live
    ? {}
    : {
        BRAPI_BASE_URL: `http://localhost:${FIXTURE_PORT}/api`,
        BCB_SGS_BASE_URL: `http://localhost:${FIXTURE_PORT}/dados/serie`,
      }),
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    ...(live
      ? []
      : [
          {
            command: "node tests/e2e/upstream-fixture.mjs",
            url: `http://localhost:${FIXTURE_PORT}/health`,
            reuseExistingServer: true,
            timeout: 60_000,
            stdout: "ignore" as const,
            stderr: "pipe" as const,
          },
        ]),
    {
      command: `npm run dev -- --port ${PORT}`,
      url: baseURL,
      // Sempre sobe um dev novo: o E2E precisa do env de fixture (reuso
      // pegaria um dev manual sem o env). Pare o `next dev` local antes.
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "ignore" as const,
      stderr: "pipe" as const,
      env: serverEnv,
    },
  ],
});
