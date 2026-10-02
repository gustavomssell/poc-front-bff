import { z } from "zod";
import {
  BRAPI_API_KEY,
  BRAPI_BASE_URL,
  HISTORY_BATCH_LIMIT,
  MAX_COMPARE_SYMBOLS,
  canDetail,
  canHistory,
} from "./config";
import { cached, type BffResult } from "./cache";
import { BffError } from "./errors";

const snapshotSchema = z.object({
  shortName: z.string(),
  longName: z.string(),
  currency: z.string(),
  regularMarketPrice: z.number(),
  regularMarketDayHigh: z.number(),
  regularMarketDayLow: z.number(),
  regularMarketChange: z.number(),
  regularMarketChangePercent: z.number(),
  regularMarketTime: z.string(),
  marketCap: z.number().nullable(),
  regularMarketVolume: z.number(),
  regularMarketPreviousClose: z.number(),
  regularMarketOpen: z.number(),
  fiftyTwoWeekRange: z.string(),
  fiftyTwoWeekLow: z.number(),
  fiftyTwoWeekHigh: z.number(),
  logourl: z.string().optional(),
});

const quoteResponseSchema = z.object({
  results: z.array(
    z.object({
      requestedSymbol: z.string(),
      symbol: z.string(),
      data: snapshotSchema,
    }),
  ),
});

const tickerQuoteSummarySchema = z.object({
  lastPrice: z.number().nullable(),
  changePercent: z.number().nullable(),
  volume: z.number().nullable(),
  marketCap: z.number().nullable(),
});

const tickerItemSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  longName: z.string().nullable().optional(),
  assetType: z.string().nullable(),
  subType: z.string().nullable().optional(),
  sector: z.string().nullable(),
  subsector: z.string().nullable().optional(),
  logoUrl: z.string().nullable(),
  quote: tickerQuoteSummarySchema,
});

const marketResponseSchema = z.object({
  results: z.array(tickerItemSchema),
  facets: z.object({
    sectors: z.array(z.string()),
    subsectors: z.array(z.string()),
    assetTypes: z.array(z.string()),
    subTypes: z.array(z.string()),
  }),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
  }),
});

const historicalPriceSchema = z.object({
  date: z.number(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
  adjustedClose: z.number().nullable(),
});

const historicalResponseSchema = z.object({
  results: z.array(
    z.object({
      symbol: z.string(),
      data: z.object({
        usedInterval: z.string(),
        usedRange: z.string(),
        historicalDataPrice: z.array(historicalPriceSchema),
      }),
    }),
  ),
});

export type {
  Quote,
  MarketRow,
  MarketFacets,
  MarketPage,
  HistoryPoint,
  HistorySeries,
  UnavailableSymbol,
  CompareResult,
} from "../types";

import type {
  CompareResult,
  HistorySeries,
  MarketPage,
  MarketRow,
  Quote,
  Sparkline,
  UnavailableSymbol,
} from "../types";

export const HISTORY_RANGES = ["1m", "3m", "6m", "1y"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

const RANGE_TO_BRAPI: Record<HistoryRange, string> = {
  "1m": "1mo",
  "3m": "3mo",
  "6m": "6mo",
  "1y": "1y",
};

export function isHistoryRange(value: string): value is HistoryRange {
  return (HISTORY_RANGES as readonly string[]).includes(value);
}

type CacheOpts = { freshMs: number; staleMs: number };

const QUOTES_CACHE: CacheOpts = { freshMs: 30_000, staleMs: 10 * 60_000 };
const MARKET_CACHE: CacheOpts = { freshMs: 15 * 60_000, staleMs: 60 * 60_000 };
const HISTORY_CACHE: CacheOpts = { freshMs: 120_000, staleMs: 30 * 60_000 };

/**
 * O plano gratuito da brapi permite apenas 1 requisição simultânea
 * (x-brapi-concurrency-limit: 1). Toda chamada upstream passa por esta fila
 * serial; chamadas concorrentes do BFF (movers, quotes, sparklines) esperam a
 * anterior em vez de receber 429.
 */
let upstreamQueue: Promise<void> = Promise.resolve();

function serializeUpstream<T>(task: () => Promise<T>): Promise<T> {
  const run = upstreamQueue.then(() => task());
  upstreamQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function brapiFetch<T>(
  cacheKey: string,
  path: string,
  params: Record<string, string | number | undefined>,
  parse: (json: unknown) => T,
  opts: CacheOpts,
): Promise<BffResult<T>> {
  return cached(
    cacheKey,
    async () => {
      const url = new URL(`${BRAPI_BASE_URL}/${path}`);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (BRAPI_API_KEY) headers.Authorization = `Bearer ${BRAPI_API_KEY}`;

      const doFetch = (): Promise<Response> =>
        fetch(url, {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });

      let response: Response;
      try {
        response = await serializeUpstream(async () => {
          let r = await doFetch();
          // 429 de concorrência vem com Retry-After: 1 — espera e repete uma vez.
          if (r.status === 429) {
            const waitSeconds = Number(r.headers.get("retry-after")) || 1;
            if (waitSeconds <= 2) {
              await sleep(waitSeconds * 1000 + 150);
              r = await doFetch();
            }
          }
          return r;
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Falha de rede";
        throw new BffError("UPSTREAM_ERROR", `brapi indisponível: ${message}`, 504);
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after")) || undefined;
        throw new BffError(
          "RATE_LIMITED",
          "Rate limit da brapi atingido. O BFF respeita Retry-After e serve cache stale.",
          429,
          retryAfter,
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new BffError(
          "REQUIRES_KEY",
          "Este ticker exige BRAPI_API_KEY (plano gratuito atende apenas os tickers de teste).",
          403,
        );
      }
      if (response.status === 404) {
        throw new BffError("NOT_FOUND", "Nenhum dado encontrado para o pedido.", 404);
      }
      if (!response.ok) {
        throw new BffError("UPSTREAM_ERROR", `brapi respondeu ${response.status}.`, 502);
      }

      const json: unknown = await response.json();
      try {
        return parse(json);
      } catch (e) {
        const detail = e instanceof Error ? e.message : "schema inválido";
        throw new BffError("UPSTREAM_ERROR", `Resposta inesperada da brapi: ${detail}`, 502);
      }
    },
    opts,
  );
}

function unixSecondsToIsoDate(seconds: number): string {
  const d = new Date(seconds * 1000);
  // Datas de pregão vêm em horário de Brasília; fixa o fuso para evitar off-by-one.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const requiresKey = (symbol: string): UnavailableSymbol => ({
  symbol,
  reason: "REQUIRES_KEY",
  message: "Cotação detalhada deste ticker exige BRAPI_API_KEY.",
});

/** Cotações detalhadas (batch). Sem chave, limita-se aos tickers de teste da brapi. */
export async function getQuotes(
  rawSymbols: string[],
): Promise<BffResult<{ quotes: Quote[]; unavailable: UnavailableSymbol[] }>> {
  const symbols = [...new Set(rawSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const allowed = symbols.filter(canDetail);
  const unavailable = symbols.filter((s) => !canDetail(s)).map(requiresKey);

  if (allowed.length === 0) {
    return { data: { quotes: [], unavailable }, status: "HIT", fetchMs: 0, ageSeconds: 0 };
  }

  // Chunk de 4: dentro do que o plano gratuito aceita por chamada.
  const quotes: Quote[] = [];
  let status: BffResult<unknown>["status"] = "MISS";
  let fetchMs = 0;
  let ageSeconds = Number.MAX_SAFE_INTEGER;

  for (const group of chunk(allowed, 4)) {
    const cacheKey = `brapi:quote:${[...group].sort().join("+")}`;
    const result = await brapiFetch(
      cacheKey,
      "v2/stocks/quote",
      { symbols: group.join(",") },
      (json) => quoteResponseSchema.parse(json).results,
      QUOTES_CACHE,
    );

    if (result.status === "HIT" || (result.status === "STALE" && status === "MISS")) {
      status = result.status;
    }
    fetchMs += result.fetchMs;
    ageSeconds = Math.min(ageSeconds, result.ageSeconds);

    const found = new Set<string>();
    for (const item of result.data) {
      found.add(item.symbol.toUpperCase());
      const d = item.data;
      quotes.push({
        symbol: item.symbol,
        name: d.longName || d.shortName,
        price: d.regularMarketPrice,
        change: d.regularMarketChange,
        changePercent: d.regularMarketChangePercent,
        volume: d.regularMarketVolume,
        marketCap: d.marketCap,
        open: d.regularMarketOpen,
        high: d.regularMarketDayHigh,
        low: d.regularMarketDayLow,
        prevClose: d.regularMarketPreviousClose,
        week52Low: d.fiftyTwoWeekLow,
        week52High: d.fiftyTwoWeekHigh,
        logoUrl: d.logourl ?? null,
        updatedAt: d.regularMarketTime,
      });
    }
    for (const symbol of group) {
      if (!found.has(symbol.toUpperCase())) {
        unavailable.push({
          symbol,
          reason: "NOT_FOUND",
          message: "Ticker não encontrado na brapi.",
        });
      }
    }
  }

  return {
    data: { quotes, unavailable },
    status: status === "MISS" && fetchMs === 0 ? "HIT" : status,
    fetchMs,
    ageSeconds: ageSeconds === Number.MAX_SAFE_INTEGER ? 0 : ageSeconds,
  };
}

export type MarketQuery = {
  q?: string;
  type?: string;
  subType?: string;
  sector?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
};

const ALLOWED_SORTS = new Set(["symbol", "name", "close", "change", "volume", "marketCap"]);

/** Screener: lista de tickers da B3 com busca, facets e ordenação (não exige chave). */
export async function getMarket(query: MarketQuery = {}): Promise<BffResult<MarketPage>> {
  const sort = query.sort && ALLOWED_SORTS.has(query.sort) ? query.sort : "volume";
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 20));

  const params = {
    search: query.q?.trim() || undefined,
    type: query.type || undefined,
    subType: query.subType || undefined,
    sector: query.sector || undefined,
    sortBy: sort,
    sortOrder: query.order === "asc" ? "asc" : "desc",
    page,
    limit,
  };

  const cacheKey = `brapi:market:${JSON.stringify(params)}`;

  return brapiFetch(
    cacheKey,
    "v2/tickers",
    params,
    (json) => {
      const parsed = marketResponseSchema.parse(json);
      return {
        items: parsed.results.map((r) => ({
          symbol: r.symbol,
          name: r.name,
          assetType: r.assetType,
          subType: r.subType ?? null,
          sector: r.sector,
          logoUrl: r.logoUrl,
          lastPrice: r.quote.lastPrice,
          changePercent: r.quote.changePercent,
          volume: r.quote.volume,
          marketCap: r.quote.marketCap,
        })),
        page: parsed.pagination.page,
        totalPages: parsed.pagination.totalPages,
        totalItems: parsed.pagination.totalItems,
        hasNextPage: parsed.pagination.hasNextPage,
        facets: {
          sectors: parsed.facets.sectors,
          assetTypes: parsed.facets.assetTypes,
          subTypes: parsed.facets.subTypes,
        },
      } satisfies MarketPage;
    },
    MARKET_CACHE,
  );
}

const MIN_MOVER_VOLUME = 100_000;

/** Maiores altas/baixas do dia entre ações com volume negociado. */
export async function getMovers(
  order: "desc" | "asc",
): Promise<BffResult<{ gainers: MarketRow[]; losers: MarketRow[] }>> {
  const result = await getMarket({
    type: "stock",
    sort: "change",
    order,
    limit: 50,
    page: 1,
  });

  const rows = result.data.items.filter(
    (r) =>
      r.changePercent != null &&
      r.lastPrice != null &&
      (r.volume ?? 0) >= MIN_MOVER_VOLUME,
  );

  const top = rows.slice(0, 5);
  return {
    data: {
      gainers: order === "desc" ? top : [],
      losers: order === "asc" ? top : [],
    },
    status: result.status,
    fetchMs: result.fetchMs,
    ageSeconds: result.ageSeconds,
  };
}

export async function getHistory(
  rawSymbol: string,
  range: HistoryRange = "1m",
): Promise<BffResult<HistorySeries>> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) throw new BffError("BAD_REQUEST", "Parâmetro symbol obrigatório.", 400);
  if (!canHistory(symbol)) throw requiresKeyError(symbol);

  const brapiRange = RANGE_TO_BRAPI[range];
  const cacheKey = `brapi:history:${symbol}:${brapiRange}`;

  const result = await brapiFetch(
    cacheKey,
    "v2/stocks/historical",
    { symbols: symbol, range: brapiRange, interval: "1d" },
    (json) => {
      const parsed = historicalResponseSchema.parse(json);
      const first = parsed.results[0];
      if (!first) throw new BffError("NOT_FOUND", `Sem histórico para ${symbol}.`, 404);
      return {
        symbol: first.symbol,
        range: first.data.usedRange,
        points: first.data.historicalDataPrice
          .map((p) => ({
            date: unixSecondsToIsoDate(p.date),
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
            volume: p.volume,
            adjustedClose: p.adjustedClose ?? p.close,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      } satisfies HistorySeries;
    },
    HISTORY_CACHE,
  );

  return result;
}

function requiresKeyError(symbol: string): BffError {
  return new BffError(
    "REQUIRES_KEY",
    `Histórico de ${symbol} exige BRAPI_API_KEY. Sem chave, a brapi atende apenas ${["PETR4", "VALE3", "MGLU3", "ITUB4"].join(", ")}.`,
    403,
  );
}

/**
 * Séries de sparkline em lote: uma chamada para todos os tickers com
 * histórico gratuito (sem chave, a brapi aceita no máximo 4 por chamada e
 * rejeita o lote inteiro se houver qualquer ticker fora da lista de teste).
 */
export async function getSparklines(
  rawSymbols: string[],
  range: HistoryRange = "1m",
): Promise<BffResult<{ sparklines: Sparkline[]; unavailable: UnavailableSymbol[] }>> {
  const symbols = [...new Set(rawSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const allowed = symbols.filter(canHistory);
  const unavailable = symbols.filter((s) => !canHistory(s)).map(requiresKey);

  if (allowed.length === 0) {
    return { data: { sparklines: [], unavailable }, status: "HIT", fetchMs: 0, ageSeconds: 0 };
  }

  const brapiRange = RANGE_TO_BRAPI[range];
  const sparklines: Sparkline[] = [];
  let status: BffResult<unknown>["status"] = "MISS";
  let fetchMs = 0;
  let ageSeconds = Number.MAX_SAFE_INTEGER;

  for (const group of chunk(allowed, HISTORY_BATCH_LIMIT)) {
    const cacheKey = `brapi:spark:${[...group].sort().join("+")}:${brapiRange}`;
    const result = await brapiFetch(
      cacheKey,
      "v2/stocks/historical",
      { symbols: group.join(","), range: brapiRange, interval: "1d" },
      (json) => {
        const parsed = historicalResponseSchema.parse(json);
        return parsed.results.map((r) => ({
          symbol: r.symbol,
          points: r.data.historicalDataPrice
            .map((p) => ({
              date: unixSecondsToIsoDate(p.date),
              value: p.adjustedClose ?? p.close,
            }))
            .filter((p): p is { date: string; value: number } => p.value != null)
            .sort((a, b) => a.date.localeCompare(b.date)),
        }));
      },
      HISTORY_CACHE,
    );

    if (result.status === "HIT" || (result.status === "STALE" && status === "MISS")) {
      status = result.status;
    }
    fetchMs += result.fetchMs;
    ageSeconds = Math.min(ageSeconds, result.ageSeconds);

    const found = new Set(result.data.map((s) => s.symbol.toUpperCase()));
    sparklines.push(...result.data);
    for (const symbol of group) {
      if (!found.has(symbol)) {
        unavailable.push({
          symbol,
          reason: "NOT_FOUND",
          message: "Sem histórico disponível para o ticker.",
        });
      }
    }
  }

  return {
    data: { sparklines, unavailable },
    status: status === "MISS" && fetchMs === 0 ? "HIT" : status,
    fetchMs,
    ageSeconds: ageSeconds === Number.MAX_SAFE_INTEGER ? 0 : ageSeconds,
  };
}

/** Histórico de N ativos na mesma janela, para comparação normalizada. */
export async function getCompare(
  rawSymbols: string[],
  range: HistoryRange = "1m",
): Promise<BffResult<CompareResult>> {
  const symbols = [
    ...new Set(rawSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ].slice(0, MAX_COMPARE_SYMBOLS);

  if (symbols.length < 2) {
    throw new BffError("BAD_REQUEST", "Informe de 2 a 4 symbols.", 400);
  }

  const allowed = symbols.filter(canHistory);
  const unavailable = symbols.filter((s) => !canHistory(s)).map(requiresKey);

  const settled = await Promise.allSettled(allowed.map((s) => getHistory(s, range)));

  const series: HistorySeries[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      series.push(outcome.value.data);
    } else {
      const symbol = allowed[i];
      unavailable.push({
        symbol,
        reason: "NOT_FOUND",
        message: outcome.reason instanceof Error ? outcome.reason.message : "Falha ao buscar histórico.",
      });
    }
  });

  const statuses = settled.filter((s) => s.status === "fulfilled").map((s) => s.value.status);
  const allHit = statuses.length > 0 && statuses.every((s) => s === "HIT");

  return {
    data: { series, unavailable },
    status: allHit ? "HIT" : statuses.includes("MISS") ? "MISS" : "STALE",
    fetchMs: 0,
    ageSeconds: 0,
  };
}
