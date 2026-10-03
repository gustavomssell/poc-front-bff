# Mercado B3 — POC BFF

[![CI](https://github.com/gustavomssell/poc-front-bff/actions/workflows/ci.yml/badge.svg)](https://github.com/gustavomssell/poc-front-bff/actions/workflows/ci.yml)

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
| `BFF_RATE_LIMIT_MAX` | Requisições por IP por minuto no BFF (padrão: 120) |
| `BRAPI_BASE_URL` / `BCB_SGS_BASE_URL` | Sobrescrevem as APIs upstream (usadas pelo E2E apontando para a fixture local) |

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
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run start      # serve o build de produção
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Testes

```bash
npm run test:unit    # Vitest: cache, rate limit, contrato HTTP, format, config
npm run test:e2e     # Playwright (chromium) — hermético, sem rede
E2E_LIVE=1 npm run test:e2e   # mesmo suíte contra as APIs reais (Linux/macOS)
```

- **Unit**: `tests/unit/**` — lógica pura do BFF (TTL/stale/single-flight do cache, rate limit, validação de env, contrato `{data, meta}` / `{error}`).
- **E2E**: `tests/e2e/**` — o Playwright sobe o dev server **com o upstream
  fixture** (`tests/e2e/upstream-fixture.mjs`, porta 4100) que emula brapi e
  BCB com dados determinísticos; `BRAPI_BASE_URL`/`BCB_SGS_BASE_URL` apontam
  para ele, cobrindo SSR e chamadas do cliente. Por isso o E2E não depende de
  rede nem do rate limit público — e roda em ~20s.
- **Antes de rodar o E2E**: pare o `next dev` local (o Playwright sobe o seu
  na porta 3001 com o env de fixture e falha se a porta estiver ocupada).
- **Ao vivo**: `E2E_LIVE=1` omite a fixture e usa as APIs reais (sujeito a
  20 req/min da brapi); no PowerShell: `$env:E2E_LIVE='1'; npm run test:e2e`.

## CI

`.github/workflows/ci.yml` roda em todo push/PR: `lint` + `typecheck` +
`test:unit` + `build` (job `quality`) e o Playwright hermético (job `e2e`).
Dependabot (`.github/dependabot.yml`) abre PRs semanais de npm e actions.

## Segurança e operação

- Rate limit por IP no BFF (`429` + `retry-after` + headers
  `x-ratelimit-*`), configurável via `BFF_RATE_LIMIT_MAX`.
- Log estruturado em JSON por requisição (`bff.request`,
  `bff.request_failed`, `bff.rate_limited`) no stdout do servidor.
- Security headers em `next.config.ts`: CSP (com `unsafe-eval` só em dev),
  `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS.
- Env validada com Zod (`lib/server/config.ts`): valor inválido gera aviso
  estruturado e cai nos defaults — nunca derruba o boot.
- Páginas de erro: `app/error.tsx` (retry), `app/not-found.tsx` (404),
  `app/loading.tsx` (skeleton).

Stack: Next.js 16 (App Router, Route Handlers) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Recharts · Zod · Vitest · Playwright.
