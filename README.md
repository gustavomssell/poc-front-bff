# Mercado B3 — POC BFF

Dashboard financeiro da B3 construído para demonstrar o padrão **Backend-for-Frontend (BFF)**: o browser conversa apenas com um BFF em Next.js (Route Handlers), que consolida, cacheia e normaliza APIs públicas antes de responder ao cliente.

> POC técnica — não é recomendação de investimento.

## Rodando

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

Variáveis (opcionais, veja `.env.example`):

| Variável | Efeito |
| --- | --- |
| `BRAPI_API_KEY` | Libera cotação/histórico de qualquer ticker da B3 (sem chave: apenas PETR4, VALE3, MGLU3, ITUB4) |
| `BRAPI_WATCHLIST` | Watchlist do dashboard (padrão: 4 ações de teste + 2 FIIs) |

## Arquitetura

```
Browser (React/Tailwind/shadcn)
   │  1 chamada por seção — nunca fala com a API externa
   ▼
BFF Next.js (Route Handlers)                app/api/*/
   ├─ cache em memória TTL + single-flight   lib/server/cache.ts
   ├─ fila serial de upstream (1 por vez)    lib/server/brapi.ts
   ├─ erros parciais por fonte               lib/server/dashboard.ts
   └─ contrato { data, meta } + headers      lib/server/http.ts
   ▼                          ▼
brapi.dev (B3)            BCB SGS (macro)
```

### Endpoints do BFF

| Rota | O que entrega |
| --- | --- |
| `GET /api/dashboard` | Payload agregado (KPIs, watchlist, macro) — o contrato completo |
| `GET /api/market` | Screener: busca, facets, filtros, ordenação, paginação |
| `GET /api/quotes?symbols=` | Cotações detalhadas em lote |
| `GET /api/history/:symbol?range=` | Histórico diário (1m/3m/6m/1y) |
| `GET /api/compare?symbols=&range=` | N ativos na mesma janela, para comparação base 100 |
| `GET /api/macro` | Selic, IPCA 12m, USD/BRL + séries |

### Contrato HTTP (visível no card "Contrato BFF")

- Corpo: `{ data, meta }` — `meta` traz `generatedAt`, `cache` (HIT/STALE/MISS/PARTIAL), `sources[]` com status e `fetchMs` por origem, `errors[]` e `flags`.
- Headers: `x-bff-cache`, `x-bff-generated-at`, `x-bff-upstream-ms`.
- Erros: `{ error: { code, message } }` com codes semânticos (`RATE_LIMITED`, `REQUIRES_KEY`, `UPSTREAM_ERROR`…).

## Restrições das APIs públicas (o que a POC honra)

- **brapi sem chave**: cotação/histórico apenas de PETR4, VALE3, MGLU3, ITUB4; `/v2/tickers` (lista) é livre. O watchlist inclui MXRF11/HGLG11 de propósito para exibir o estado **sem chave** na UI.
- **brapi plano gratuito**: 20 req/min **e apenas 1 requisição simultânea** (`x-brapi-concurrency-limit: 1`) — o BFF serializa upstream em fila com retry de 429 (`lib/server/brapi.ts`).
- **BCB SGS**: `ultimos` aceita no máximo 20 pontos; o endpoint é intermitente sob rajada — o BFF limita o lote e repete uma vez com backoff (`lib/server/bcb.ts`).
- Erros upstream não derrubam a página: cada seção degrada isoladamente e o `meta.errors` explica o que falhou.

## Comandos

```bash
npm run dev       # desenvolvimento
npm run build     # build de produção
npm run lint      # eslint
npx tsc --noEmit  # typecheck
```

Stack: Next.js 16 (App Router, Route Handlers) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Recharts · Zod.
