export const BRAPI_BASE_URL = "https://brapi.dev/api";
export const BCB_SGS_BASE_URL = "https://api.bcb.gov.br/dados/serie";

export const BRAPI_API_KEY = process.env.BRAPI_API_KEY ?? "";
export const HAS_BRAPI_KEY = BRAPI_API_KEY.trim().length > 0;

/**
 * Tickers que a brapi atende sem chave (plano gratuito de teste).
 * Qualquer outro symbol — inclusive FIIs — responde 401 MISSING_TOKEN,
 * sozinho ou dentro de um lote.
 */
export const FREE_TICKERS = ["PETR4", "VALE3", "MGLU3", "ITUB4"];

/** Watchlist padrão: inclui FIIs para expor na UI o estado "sem chave". */
export const DEFAULT_WATCHLIST = [...FREE_TICKERS, "MXRF11", "HGLG11"];

/**
 * Subconjunto com histórico gratuito — idêntico aos de cotação; o endpoint
 * historical também responde 401 para qualquer ticker fora da lista.
 */
export const HISTORY_TEST_TICKERS = FREE_TICKERS;

export const MAX_COMPARE_SYMBOLS = 4;

/** Lote máximo do histórico no plano gratuito (batch com qualquer outro ticker dá 401). */
export const HISTORY_BATCH_LIMIT = 4;

export function getWatchlist(): string[] {
  const raw = process.env.BRAPI_WATCHLIST;
  const parsed = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_WATCHLIST;
}

export function canDetail(symbol: string): boolean {
  return HAS_BRAPI_KEY || FREE_TICKERS.includes(symbol.toUpperCase());
}

export function canHistory(symbol: string): boolean {
  return HAS_BRAPI_KEY || HISTORY_TEST_TICKERS.includes(symbol.toUpperCase());
}

export const FREE_TICKERS_ONLY = !HAS_BRAPI_KEY;
