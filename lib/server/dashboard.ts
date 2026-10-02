import { getMovers, getQuotes, getSparklines } from "./brapi";
import { getMacro } from "./bcb";
import { HAS_BRAPI_KEY, getWatchlist } from "./config";
import { getMarketStatus } from "./market";
import { isBffError, type BffError } from "./errors";
import type { CacheStatus } from "./cache";

export type {
  DashboardMeta,
  DashboardPayload,
  KpisSection,
  MacroSection,
  MetaSource,
  Sparkline,
  WatchlistSection,
} from "../types";

import type {
  DashboardMeta,
  DashboardPayload,
  KpisSection,
  MacroSection,
  MetaSource,
  WatchlistSection,
} from "../types";

class MetaBuilder {
  private sources: MetaSource[] = [];
  private errors: DashboardMeta["errors"] = [];

  track(source: "brapi" | "bcb", status: CacheStatus, fetchMs: number): void {
    const existing = this.sources.find((s) => s.source === source);
    if (existing) {
      existing.fetchMs += fetchMs;
      if (existing.status !== status) {
        existing.status = existing.status === undefined ? status : "STALE";
      }
    } else {
      this.sources.push({ source, status, fetchMs });
    }
  }

  fail(source: string, e: unknown): void {
    const err = e as BffError;
    this.errors.push({
      source,
      code: isBffError(e) ? err.code : "UNKNOWN",
      message: err?.message ?? "Erro desconhecido",
    });
  }

  merge(other: DashboardMeta): void {
    for (const s of other.sources) this.track(s.source, s.status ?? "MISS", s.fetchMs);
    this.errors.push(...other.errors);
  }

  build(): DashboardMeta {
    const statuses = this.sources.map((s) => s.status).filter(Boolean) as CacheStatus[];
    const unique = new Set(statuses);
    const cache =
      statuses.length === 0
        ? ("MISS" as const)
        : unique.size === 1
          ? statuses[0]
          : ("PARTIAL" as const);

    return {
      generatedAt: new Date().toISOString(),
      cache,
      sources: this.sources,
      errors: this.errors,
      flags: { hasApiKey: HAS_BRAPI_KEY, watchlist: getWatchlist() },
    };
  }
}

function section<T>(data: T, meta: MetaBuilder): { data: T; meta: DashboardMeta } {
  return { data, meta: meta.build() };
}

export async function getKpisSection(): Promise<{
  data: KpisSection;
  meta: DashboardMeta;
}> {
  const meta = new MetaBuilder();

  const [macroOutcome, gainersOutcome, losersOutcome] = await Promise.allSettled([
    getMacro(),
    getMovers("desc"),
    getMovers("asc"),
  ]);

  const empty: KpisSection = {
    selic: null,
    ipca12m: null,
    usd: null,
    gainers: [],
    losers: [],
  };

  if (macroOutcome.status === "fulfilled" && macroOutcome.value) {
    const r = macroOutcome.value;
    meta.track("bcb", r.status, r.fetchMs);
    empty.selic = r.data.selic;
    empty.ipca12m = r.data.ipca12m;
    empty.usd = {
      value: r.data.usd.value,
      date: r.data.usd.date,
      changePercent: r.data.usdChangePercent,
    };
  } else if (macroOutcome.status === "rejected") {
    meta.fail("bcb", macroOutcome.reason);
  }

  if (gainersOutcome.status === "fulfilled") {
    meta.track("brapi", gainersOutcome.value.status, gainersOutcome.value.fetchMs);
    empty.gainers = gainersOutcome.value.data.gainers;
  } else {
    meta.fail("brapi", gainersOutcome.reason);
  }

  if (losersOutcome.status === "fulfilled") {
    meta.track("brapi", losersOutcome.value.status, losersOutcome.value.fetchMs);
    empty.losers = losersOutcome.value.data.losers;
  } else {
    meta.fail("brapi", losersOutcome.reason);
  }

  return section(empty, meta);
}

export async function getWatchlistSection(): Promise<{
  data: WatchlistSection;
  meta: DashboardMeta;
}> {
  const meta = new MetaBuilder();
  const symbols = getWatchlist();

  const [quotesOutcome, sparkOutcome] = await Promise.allSettled([
    getQuotes(symbols),
    getSparklines(symbols, "1m"),
  ]);

  const data: WatchlistSection = { quotes: [], sparklines: [], unavailable: [] };

  if (quotesOutcome.status === "fulfilled") {
    meta.track("brapi", quotesOutcome.value.status, quotesOutcome.value.fetchMs);
    data.quotes = quotesOutcome.value.data.quotes;
    data.unavailable = quotesOutcome.value.data.unavailable;
  } else {
    meta.fail("brapi", quotesOutcome.reason);
  }

  if (sparkOutcome.status === "fulfilled") {
    meta.track("brapi", sparkOutcome.value.status, sparkOutcome.value.fetchMs);
    data.sparklines = sparkOutcome.value.data.sparklines;
    for (const u of sparkOutcome.value.data.unavailable) {
      if (!data.unavailable.some((x) => x.symbol === u.symbol)) {
        data.unavailable.push(u);
      }
    }
  } else {
    // Sem chave, sparkline de ticker fora da lista de teste é limitação esperada.
    if (!isBffError(sparkOutcome.reason) || sparkOutcome.reason.code !== "REQUIRES_KEY") {
      meta.fail("brapi", sparkOutcome.reason);
    }
  }

  return section(data, meta);
}

export async function getMacroSection(): Promise<{
  data: MacroSection;
  meta: DashboardMeta;
}> {
  const meta = new MetaBuilder();
  try {
    const r = await getMacro();
    meta.track("bcb", r.status, r.fetchMs);
    return section(r.data, meta);
  } catch (e) {
    meta.fail("bcb", e);
    return section(null, meta);
  }
}

/** Payload agregado do endpoint /api/dashboard (1 chamada para o cliente). */
export async function getDashboard(): Promise<{
  data: DashboardPayload;
  meta: DashboardMeta;
}> {
  const [kpis, watchlist, macro] = await Promise.all([
    getKpisSection(),
    getWatchlistSection(),
    getMacroSection(),
  ]);

  const merged = new MetaBuilder();
  merged.merge(kpis.meta);
  merged.merge(watchlist.meta);
  merged.merge(macro.meta);

  return {
    data: {
      market: getMarketStatus(),
      kpis: kpis.data,
      watchlist: watchlist.data,
      macro: macro.data,
    },
    meta: merged.build(),
  };
}
