/**
 * Tipos de domínio compartilhados entre a camada server (BFF) e os
 * componentes client. Este módulo não importa nada de server — é seguro
 * para o bundle do navegador.
 */

export type CacheStatus = "HIT" | "STALE" | "MISS";

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  week52Low: number;
  week52High: number;
  logoUrl: string | null;
  updatedAt: string;
};

export type MarketRow = {
  symbol: string;
  name: string;
  assetType: string | null;
  subType: string | null;
  sector: string | null;
  logoUrl: string | null;
  lastPrice: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
};

export type MarketFacets = {
  sectors: string[];
  assetTypes: string[];
  subTypes: string[];
};

export type MarketPage = {
  items: MarketRow[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  facets: MarketFacets;
};

export type HistoryPoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  adjustedClose: number | null;
};

export type HistorySeries = {
  symbol: string;
  range: string;
  points: HistoryPoint[];
};

export type UnavailableSymbol = {
  symbol: string;
  reason: "REQUIRES_KEY" | "NOT_FOUND";
  message: string;
};

export type CompareResult = {
  series: HistorySeries[];
  unavailable: UnavailableSymbol[];
};

export type MacroPoint = { date: string; value: number };

export type MacroSnapshot = {
  selic: MacroPoint;
  ipca12m: MacroPoint;
  usd: MacroPoint;
  usdChangePercent: number | null;
  timeline: { selic: MacroPoint[]; ipca: MacroPoint[] };
  usdSeries: MacroPoint[];
};

export type Sparkline = { symbol: string; points: { date: string; value: number }[] };

export type KpisSection = {
  selic: { value: number; date: string } | null;
  ipca12m: { value: number; date: string } | null;
  usd: { value: number; date: string; changePercent: number | null } | null;
  gainers: MarketRow[];
  losers: MarketRow[];
};

export type WatchlistSection = {
  quotes: Quote[];
  sparklines: Sparkline[];
  unavailable: UnavailableSymbol[];
};

export type MacroSection = MacroSnapshot | null;

export type MarketStatus = {
  open: boolean;
  label: string;
  hint: string;
};

export type DashboardPayload = {
  market: MarketStatus;
  kpis: KpisSection;
  watchlist: WatchlistSection;
  macro: MacroSection;
};

export type MetaSource = {
  source: "brapi" | "bcb";
  status?: CacheStatus;
  fetchMs: number;
};

export type DashboardMeta = {
  generatedAt: string;
  cache: CacheStatus | "PARTIAL";
  sources: MetaSource[];
  errors: { source: string; code: string; message: string }[];
  flags: { hasApiKey: boolean; watchlist: string[] };
};

export type HttpMeta = {
  generatedAt: string;
  cache: CacheStatus | "PARTIAL";
  sources: MetaSource[];
  ageSeconds?: number;
  fetchMs?: number;
  /** Presente no endpoint agregado /api/dashboard. */
  errors?: { source: string; code: string; message: string }[];
  flags?: { hasApiKey: boolean; watchlist: string[] };
};

export type ApiEnvelope<T> = { data: T; meta: HttpMeta };
