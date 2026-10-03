/**
 * Servidor upstream de fixtures para o E2E.
 *
 * Emula os endpoints da brapi (v2/tickers, v2/stocks/quote,
 * v2/stocks/historical) e do SGS/BCB que o BFF consome, com dados
 * determinísticos — o E2E roda sem rede e sem cair no rate limit de
 * 20 req/min das APIs públicas. O dev server do Playwright aponta
 * BRAPI_BASE_URL/BCB_SGS_BASE_URL para cá.
 *
 * Sem dependências: node puro, iniciado pelo playwright.config.ts.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.UPSTREAM_PORT ?? 4100);

// ---------------------------------------------------------------------------
// Dataset determinístico (45 tickers da B3)
// ---------------------------------------------------------------------------

/** symbol, name, assetType, subType, sector, subsector, price, changePercent, volume, marketCap */
const RAW = [
  ["PETR4", "Petrobras PN", "stock", "PN", "Petróleo, Gás e Biocombustíveis", "Exploração, Refino e Distribuição", 38.42, 1.24, 98_500_000, 495e9],
  ["VALE3", "Vale ON", "stock", "ON", "Mineração", "Mineração de Minérios de Ferro", 61.35, -0.87, 72_300_000, 278e9],
  ["ITUB4", "Itaú Unibanco PN", "stock", "PN", "Financeiro", "Bancos", 33.71, 0.42, 41_200_000, 321e9],
  ["BBDC4", "Bradesco PN", "stock", "PN", "Financeiro", "Bancos", 14.98, -0.33, 38_500_000, 194e9],
  ["BBAS3", "Banco do Brasil ON", "stock", "ON", "Financeiro", "Bancos", 27.64, 0.91, 29_800_000, 139e9],
  ["ABEV3", "Ambev ON", "stock", "ON", "Consumo Básico", "Bebidas", 12.35, 0.57, 27_400_000, 193e9],
  ["B3SA3", "B3 ON", "stock", "ON", "Financeiro", "Bolsas e Balcões", 11.82, 1.85, 24_600_000, 128e9],
  ["WEGE3", "WEG ON", "stock", "ON", "Bens Industriais", "Máquinas e Equipamentos", 54.77, -0.42, 12_100_000, 204e9],
  ["MGLU3", "Magazine Luiza ON", "stock", "ON", "Comércio e Distribuição", "Varejo", 11.06, 2.31, 33_900_000, 110e9],
  ["RENT3", "Localiza ON", "stock", "ON", "Consumo Discricionário", "Aluguel de Carros", 44.19, -1.12, 9_800_000, 140e9],
  ["SUZ3", "Suzano ON", "stock", "ON", "Materiais Básicos", "Papel e Celulose", 25.63, 0.68, 14_300_000, 89e9],
  ["GGB4", "Gerdau PN", "stock", "PN", "Materiais Básicos", "Siderurgia", 12.44, -0.96, 21_700_000, 67e9],
  ["CSAN3", "Cosan ON", "stock", "ON", "Petróleo, Gás e Biocombustíveis", "Distribuição de Gás", 24.08, 0.25, 11_400_000, 64e9],
  ["PRIO3", "Prio ON", "stock", "ON", "Petróleo, Gás e Biocombustíveis", "Exploração e Produção", 41.27, 3.12, 18_600_000, 63e9],
  ["RADL3", "Raia Drogasil ON", "stock", "ON", "Saúde", "Farmácias e Drogarias", 22.91, -0.18, 8_200_000, 72e9],
  ["EMBR3", "Embraer ON", "stock", "ON", "Bens Industriais", "Aeronáutica e Defesa", 52.44, 2.74, 7_600_000, 40e9],
  ["UGPA3", "Ultrapar ON", "stock", "ON", "Petróleo, Gás e Biocombustíveis", "Distribuição de Combustíveis", 15.73, -0.63, 16_900_000, 36e9],
  ["CCRO3", "CCR ON", "stock", "ON", "Transporte", "Concessões Rodoviárias", 26.15, 0.49, 10_500_000, 45e9],
  ["ELET3", "Eletrobras ON", "stock", "ON", "Serviços Públicos", "Energia Elétrica", 13.87, 1.02, 19_400_000, 48e9],
  ["CPFE3", "CPFL Energia ON", "stock", "ON", "Serviços Públicos", "Energia Elétrica", 28.46, -0.21, 5_100_000, 28e9],
  ["TIMS3", "TIM ON", "stock", "ON", "Comunicações", "Telecomunicações", 17.92, 0.34, 13_800_000, 46e9],
  ["VIVT3", "Telefônica Brasil ON", "stock", "ON", "Comunicações", "Telecomunicações", 45.31, -0.77, 6_400_000, 71e9],
  ["LREN3", "Lojas Renner ON", "stock", "ON", "Comércio e Distribuição", "Varejo", 21.04, 1.47, 7_100_000, 35e9],
  ["AMER3", "Americanas ON", "stock", "ON", "Comércio e Distribuição", "Varejo", 1.06, 4.95, 62_300_000, 4e9],
  ["AZUL4", "Azul PN", "stock", "PN", "Transporte", "Transporte Aéreo", 7.84, 3.88, 41_900_000, 8e9],
  ["GOLG4", "Gol PN", "stock", "PN", "Transporte", "Transporte Aéreo", 3.21, -2.44, 44_700_000, 2e9],
  ["CVCB3", "CVC Brasil ON", "stock", "ON", "Consumo Discricionário", "Viagens e Turismo", 5.63, 1.16, 12_600_000, 4e9],
  ["HAPV3", "Hapvida ON", "stock", "ON", "Saúde", "Planos de Saúde", 4.72, -1.35, 28_100_000, 24e9],
  ["FLRY3", "Fleury ON", "stock", "ON", "Saúde", "Hospitais e Laboratórios", 17.46, 0.86, 5_900_000, 17e9],
  ["KLBN11", "Klabin PN11", "stock", "PN N2", "Materiais Básicos", "Papel e Celulose", 9.94, -0.51, 15_800_000, 25e9],
  ["TOTS3", "Totvs ON", "stock", "ON", "Tecnologia da Informação", "Software", 32.57, 2.08, 6_800_000, 21e9],
  ["SLCE3", "SLC Agrícola ON", "stock", "ON", "Consumo Básico", "Agropecuária", 15.18, -0.92, 9_400_000, 14e9],
  ["RAIZ4", "Raízen ON", "stock", "ON", "Petróleo, Gás e Biocombustíveis", "Álcool e Açúcar", 6.58, 1.73, 17_200_000, 12e9],
  ["VVAR3", "Varejão ON", "stock", "ON", "Comércio e Distribuição", "Varejo", 12.87, -1.68, 22_400_000, 13e9],
  ["CGAS5", "Gas Natural ON", "stock", "ON", "Serviços Públicos", "Gás Natural", 15.31, 0.66, 4_800_000, 4e9],
  ["BBSE3", "BB Seguridade ON", "stock", "ON", "Financeiro", "Seguros", 47.62, 0.14, 4_300_000, 29e9],
  ["BPAC11", "BTG Pactual PN11", "stock", "PN N2", "Financeiro", "Bancos", 41.05, 0.73, 8_700_000, 40e9],
  ["MXRF11", "Maxi Renda FII", "fund", "CI", "FIIs - Papel", "Fundo de Investimento", 10.72, 0.09, 3_100_000, 4e9],
  ["HGLG11", "HSI Logística FII", "fund", "CI", "FIIs - Tijolo", "Fundo de Investimento", 161.4, -0.15, 420_000, 2e9],
  ["KNRI11", "Kinea Renda Imobiliária FII", "fund", "CI", "FIIs - Tijolo", "Fundo de Investimento", 93.18, 0.22, 610_000, 3e9],
  ["XPML11", "XP Malls FII", "fund", "CI", "FIIs - Tijolo", "Fundo de Investimento", 105.77, 0.31, 380_000, 3e9],
  ["BOVA11", "iShares Ibovespa ETF", "etf", "CI", "ETFs", "Fundo de Índice", 132.55, 0.64, 9_200_000, 30e9],
  ["IVVB11", "iShares S&P 500 ETF", "etf", "CI", "ETFs", "Fundo de Índice", 385.12, 0.94, 740_000, 25e9],
  ["AAPL3", "Apple BDR", "bdr", "DRN", "BDRs", "Tecnologia", 74.31, 1.08, 2_900_000, 5e9],
  ["MSFT3", "Microsoft BDR", "bdr", "DRN", "BDRs", "Tecnologia", 68.94, 0.77, 2_100_000, 4e9],
];

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function seedFrom(symbol) {
  let h = 2166136261;
  for (const ch of symbol) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DATASET = RAW.map(
  ([symbol, name, assetType, subType, sector, subsector, price, changePercent, volume, marketCap]) => {
    const rand = lcg(seedFrom(symbol));
    const change = round2((price * changePercent) / 100);
    const prevClose = round2(price - change);
    const open = round2(prevClose * (1 + (rand() - 0.5) * 0.01));
    const high = round2(Math.max(price, open) * (1 + rand() * 0.008));
    const low = round2(Math.min(price, open) * (1 - rand() * 0.008));
    const week52Low = round2(price * (0.62 + rand() * 0.1));
    const week52High = round2(price * (1.18 + rand() * 0.2));
    return {
      symbol,
      name,
      assetType,
      subType,
      sector,
      subsector,
      logoUrl: null,
      quote: {
        lastPrice: price,
        changePercent,
        volume,
        marketCap,
      },
      snapshot: {
        shortName: name,
        longName: `${name} — ${symbol}`,
        currency: "BRL",
        regularMarketPrice: price,
        regularMarketDayHigh: high,
        regularMarketDayLow: low,
        regularMarketChange: change,
        regularMarketChangePercent: changePercent,
        regularMarketTime: "16:05:00",
        marketCap,
        regularMarketVolume: volume,
        regularMarketPreviousClose: prevClose,
        regularMarketOpen: open,
        fiftyTwoWeekRange: `${week52Low.toFixed(2)} - ${week52High.toFixed(2)}`,
        fiftyTwoWeekLow: week52Low,
        fiftyTwoWeekHigh: week52High,
      },
    };
  },
);

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Histórico determinístico (dias úteis de volta a partir de hoje)
// ---------------------------------------------------------------------------

const RANGE_POINTS = { "1mo": 22, "3mo": 64, "6mo": 128, "1y": 250 };

function businessDaysBack(count) {
  const days = [];
  const cursor = new Date();
  cursor.setUTCHours(12, 0, 0, 0);
  while (days.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days.reverse();
}

function historical(symbol, range) {
  const points = RANGE_POINTS[range] ?? 22;
  const row = DATASET.find((t) => t.symbol === symbol);
  const last = row ? row.quote.lastPrice : 10;
  const rand = lcg(seedFrom(symbol) ^ 0x9e3779b9);
  const days = businessDaysBack(points);

  const closes = [];
  let value = last / (1 + (rand() - 0.5) * 0.12);
  for (let i = 0; i < points; i++) {
    value *= 1 + (rand() - 0.48) * 0.03;
    closes.push(value);
  }
  const scale = last / closes[closes.length - 1];

  return days.map((day, i) => {
    const close = round2(closes[i] * scale);
    const open = round2(close * (1 + (rand() - 0.5) * 0.01));
    const high = round2(Math.max(open, close) * (1 + rand() * 0.006));
    const low = round2(Math.min(open, close) * (1 - rand() * 0.006));
    return {
      date: Math.floor(day.getTime() / 1000),
      open,
      high,
      low,
      close,
      volume: Math.round((row ? row.quote.volume : 1_000_000) * (0.6 + rand() * 0.8)),
      adjustedClose: close,
    };
  });
}

// ---------------------------------------------------------------------------
// Séries SGS/BCB
// ---------------------------------------------------------------------------

function bcbSeries(code, count) {
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  const days = [];
  const cursor = new Date(start);
  while (days.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  days.reverse();

  const rand = lcg(code * 2654435761);
  const base = { 1178: 14.9, 4189: 1.15, 13522: 4.28, 1: 5.42 }[code] ?? 1;
  return days.map((day, i) => {
    const drift = (rand() - 0.5) * base * 0.04 + (i / Math.max(1, count - 1)) * base * 0.03;
    const value = base + drift - (base * 0.03);
    const dd = String(day.getUTCDate()).padStart(2, "0");
    const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = day.getUTCFullYear();
    return {
      data: `${dd}/${mm}/${yyyy}`,
      valor: value.toFixed(2).replace(".", ","),
    };
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function facetsOf(rows) {
  const uniq = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    sectors: uniq(rows.map((r) => r.sector)),
    subsectors: uniq(rows.map((r) => r.subsector)),
    assetTypes: uniq(rows.map((r) => r.assetType)),
    subTypes: uniq(rows.map((r) => r.subType)),
  };
}

function handleTickers(res, params) {
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const type = params.get("type") ?? "";
  const subType = params.get("subType") ?? "";
  const sector = params.get("sector") ?? "";
  const sortBy = params.get("sortBy") ?? "volume";
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 20) || 20));

  let rows = DATASET.filter((r) => {
    if (type && r.assetType !== type) return false;
    if (subType && r.subType !== subType) return false;
    if (sector && r.sector !== sector) return false;
    if (!search) return true;
    return (
      r.symbol.toLowerCase().includes(search) ||
      r.name.toLowerCase().includes(search) ||
      r.sector.toLowerCase().includes(search)
    );
  });

  const keyOf = {
    symbol: (r) => r.symbol,
    name: (r) => r.name,
    close: (r) => r.quote.lastPrice,
    change: (r) => r.quote.changePercent,
    volume: (r) => r.quote.volume,
    marketCap: (r) => r.quote.marketCap ?? -Infinity,
  }[sortBy];
  const dir = sortOrder === "asc" ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    const av = keyOf(a);
    const bv = keyOf(b);
    if (typeof av === "string") return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });

  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const slice = rows.slice((page - 1) * limit, page * limit);

  sendJson(res, 200, {
    results: slice.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      longName: r.snapshot.longName,
      assetType: r.assetType,
      subType: r.subType,
      sector: r.sector,
      subsector: r.subsector,
      logoUrl: r.logoUrl,
      quote: r.quote,
    })),
    facets: facetsOf(DATASET),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
    },
  });
}

function handleQuote(res, params) {
  const symbols = (params.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const results = symbols
    .map((symbol) => {
      const row = DATASET.find((t) => t.symbol === symbol);
      if (!row) return null;
      return { requestedSymbol: symbol, symbol: row.symbol, data: row.snapshot };
    })
    .filter(Boolean);

  if (results.length === 0) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  sendJson(res, 200, { results });
}

function handleHistorical(res, params) {
  const symbols = (params.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const range = params.get("range") ?? "1mo";

  const results = symbols
    .map((symbol) => {
      const row = DATASET.find((t) => t.symbol === symbol);
      if (!row) return null;
      return {
        symbol,
        data: {
          usedInterval: params.get("interval") ?? "1d",
          usedRange: range,
          historicalDataPrice: historical(symbol, range),
        },
      };
    })
    .filter(Boolean);

  if (results.length === 0) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  sendJson(res, 200, { results });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (path.endsWith("/v2/tickers")) {
    handleTickers(res, url.searchParams);
    return;
  }
  if (path.endsWith("/v2/stocks/quote")) {
    handleQuote(res, url.searchParams);
    return;
  }
  if (path.endsWith("/v2/stocks/historical")) {
    handleHistorical(res, url.searchParams);
    return;
  }

  const sgs = path.match(/bcdata\.sgs\.(\d+)\/dados\/ultimos\/(\d+)/);
  if (sgs) {
    const code = Number(sgs[1]);
    const count = Math.min(20, Number(sgs[2]) || 1);
    sendJson(res, 200, bcbSeries(code, count));
    return;
  }

  sendJson(res, 404, { error: `fixture upstream: rota desconhecida ${path}` });
});

server.listen(PORT, () => {
  console.log(`upstream fixture ouvindo em http://localhost:${PORT}`);
});
