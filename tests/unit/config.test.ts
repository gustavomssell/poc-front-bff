import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return await import("@/lib/server/config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("getWatchlist", () => {
  it("usa a watchlist padrão quando BRAPI_WATCHLIST está ausente/vazia", async () => {
    vi.stubEnv("BRAPI_WATCHLIST", "");
    const cfg = await loadConfig();

    expect(cfg.getWatchlist()).toEqual(cfg.DEFAULT_WATCHLIST);
    expect(cfg.getWatchlist()).toEqual([...cfg.FREE_TICKERS, "MXRF11", "HGLG11"]);
  });

  it("parseia BRAPI_WATCHLIST em lista maiúscula sem vazios", async () => {
    vi.stubEnv("BRAPI_WATCHLIST", "petr4, vale3,,  ");
    const cfg = await loadConfig();

    expect(cfg.getWatchlist()).toEqual(["PETR4", "VALE3"]);
  });
});

describe("permissão de detalhe/histórico", () => {
  it("sem chave: só os tickers gratuitos", async () => {
    vi.stubEnv("BRAPI_API_KEY", "");
    const cfg = await loadConfig();

    expect(cfg.HAS_BRAPI_KEY).toBe(false);
    expect(cfg.FREE_TICKERS_ONLY).toBe(true);
    expect(cfg.canDetail("petr4")).toBe(true);
    expect(cfg.canDetail("MXRF11")).toBe(false);
    expect(cfg.canHistory("vaLE3")).toBe(true);
    expect(cfg.canHistory("HGLG11")).toBe(false);
  });

  it("com chave: todos os tickers liberados", async () => {
    vi.stubEnv("BRAPI_API_KEY", " token-de-teste ");
    const cfg = await loadConfig();

    expect(cfg.HAS_BRAPI_KEY).toBe(true);
    expect(cfg.FREE_TICKERS_ONLY).toBe(false);
    expect(cfg.canDetail("MXRF11")).toBe(true);
    expect(cfg.canHistory("HGLG11")).toBe(true);
  });
});

describe("limites", () => {
  it("expõe os limites usados pelo BFF", async () => {
    const cfg = await loadConfig();

    expect(cfg.MAX_COMPARE_SYMBOLS).toBe(4);
    expect(cfg.HISTORY_BATCH_LIMIT).toBe(4);
    expect(cfg.FREE_TICKERS).toEqual(["PETR4", "VALE3", "MGLU3", "ITUB4"]);
  });
});

describe("validação de env", () => {
  it("aceita um limite válido", async () => {
    vi.stubEnv("BFF_RATE_LIMIT_MAX", "30");
    const cfg = await loadConfig();

    expect(cfg.BFF_RATE_LIMIT_MAX).toBe(30);
  });

  it("env inválida cai nos defaults e avisa no log estruturado", async () => {
    vi.stubEnv("BFF_RATE_LIMIT_MAX", "não-número");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();

    const cfg = await import("@/lib/server/config");

    expect(cfg.BFF_RATE_LIMIT_MAX).toBe(120);
    expect(warn).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(warn.mock.calls[0][0] as string) as {
      level: string;
      event: string;
      issues: string[];
    };
    expect(payload.level).toBe("warn");
    expect(payload.event).toBe("bff.env_invalid");
    expect(payload.issues.join(" ")).toContain("BFF_RATE_LIMIT_MAX");
  });

  it("valores vazios contam como ausente, sem gerar aviso", async () => {
    vi.stubEnv("BRAPI_BASE_URL", "   ");
    vi.stubEnv("BFF_RATE_LIMIT_MAX", "");
    vi.stubEnv("BRAPI_WATCHLIST", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const cfg = await loadConfig();

    expect(warn).not.toHaveBeenCalled();
    expect(cfg.BRAPI_BASE_URL).toBe("https://brapi.dev/api");
    expect(cfg.BFF_RATE_LIMIT_MAX).toBe(120);
    expect(cfg.getWatchlist()).toEqual(cfg.DEFAULT_WATCHLIST);
  });
});
