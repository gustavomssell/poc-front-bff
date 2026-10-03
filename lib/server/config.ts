import { z } from "zod";

/** Janela do rate limit do BFF (fixa; o limite por janela vem do env). */
export const BFF_RATE_LIMIT_WINDOW_MS = 60_000;

const EnvSchema = z.object({
  BRAPI_API_KEY: z.string().default(""),
  BRAPI_WATCHLIST: z.string().default(""),
  BFF_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(120),
  BRAPI_BASE_URL: z.url().default("https://brapi.dev/api"),
  BCB_SGS_BASE_URL: z.url().default("https://api.bcb.gov.br/dados/serie"),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validação zod das envs do BFF. Env inválida nunca derruba o boot da POC:
 * avisa no log estruturado e cai nos defaults. Valor vazio (comum em .env
 * copiado do exemplo) conta como ausente.
 */
function loadEnv(): Env {
  const defined = (value: string | undefined): string | undefined =>
    value && value.trim() ? value : undefined;

  const parsed = EnvSchema.safeParse({
    BRAPI_API_KEY: defined(process.env.BRAPI_API_KEY),
    BRAPI_WATCHLIST: defined(process.env.BRAPI_WATCHLIST),
    BFF_RATE_LIMIT_MAX: defined(process.env.BFF_RATE_LIMIT_MAX),
    BRAPI_BASE_URL: defined(process.env.BRAPI_BASE_URL),
    BCB_SGS_BASE_URL: defined(process.env.BCB_SGS_BASE_URL),
  });
  if (parsed.success) return parsed.data;

  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      event: "bff.env_invalid",
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    }),
  );
  return EnvSchema.parse({});
}

export const env: Env = loadEnv();

export const BRAPI_BASE_URL = env.BRAPI_BASE_URL;
export const BCB_SGS_BASE_URL = env.BCB_SGS_BASE_URL;
export const BRAPI_API_KEY = env.BRAPI_API_KEY;
export const HAS_BRAPI_KEY = BRAPI_API_KEY.trim().length > 0;
export const BFF_RATE_LIMIT_MAX = env.BFF_RATE_LIMIT_MAX;

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
  const parsed = env.BRAPI_WATCHLIST
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
