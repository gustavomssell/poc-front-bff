# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desenvolvedor (eu/time) avaliando arquitetura BFF. A audiência da superfície é técnica: lê a tela para julgar o padrão, não para operar dinheiro real.

## Product Purpose

POC que demonstra Next.js como Backend-for-Frontend: uma dashboard financeira da B3 que consome APIs públicas (brapi.dev, BCB SGS) exclusivamente através de endpoints `/api/*` próprios. Sucesso = o observador entender o padrão BFF pela tela — ver a fronteira HTTP, o cache, a agregação e a normalização em ação — com dados financeiros ricos o bastante para justificar a camada.

## Positioning

O mecanismo demonstrável: o browser nunca fala com as APIs upstream. Uma chamada a `/api/dashboard` substitui N chamadas externas; o contrato expõe `x-bff-cache` (HIT/STALE/MISS), timings por fonte e erros parciais; o card "Contrato BFF" na própria tela revela o JSON e os headers. Um dashboard genérico não mostra a camada; esta POC a torna inspecionável.

## Operating Context

- Execução local: `npm run dev` (Next 16, App Router, Turbopack); sem banco de dados, sem autenticação.
- Dados reais de APIs públicas: brapi.dev (cotações, histórico, screener) e BCB SGS (Selic, IPCA, dólar).
- Restrição dura: sem `BRAPI_API_KEY` a brapi atende apenas os tickers de teste PETR4, VALE3, MGLU3, ITUB4, MXRF11, HGLG11 a 20 req/min/IP; com chave grátis amplia. Limitações aparecem como estados na UI, nunca como dado inventado.
- Inspecionar = Dev Network tab (só chamadas same-origin) + card Contrato BFF (JSON, headers, timings).
- Idioma da interface: pt-BR (inferido da conversa; não confirmado explicitamente).

## Capabilities and Constraints

- Seções: top bar com status do pregão B3; KPIs (Selic, IPCA 12m, dólar, maior alta/baixa); watchlist com sparklines; gráfico do ativo com ranges 1m/3m/6m/1y; screener com busca, filtros (tipo/subtipo/setor), ordenação e paginação; comparação de até 4 ativos normalizada (base 100); gráficos macro (Selic × IPCA, dólar 30d); card Contrato BFF; auto-refresh 60s.
- BFF: 6 endpoints (dashboard, market, quotes, history, compare, macro) sobre camada `lib/server` compartilhada entre SSR e HTTP; cache TTL em memória com stale-while-revalidate e single-flight; Zod como anti-corruption layer; chave API somente no server.
- Erros parciais por fonte: uma API fora do ar não derruba a tela.

## Brand Commitments

- UI obrigatoriamente com shadcn/ui + Tailwind (compromisso explícito do usuário).

## Evidence on Hand

- Respostas ao vivo testadas das APIs brapi (`/v2/tickers`, `/v2/stocks/quote`, `/v2/stocks/historical`) e BCB SGS (séries 1178, 4189, 13522, 1); screenshots ou testimonials não existem — POC sem histórico de uso.

## Product Principles

1. O padrão BFF deve ser demonstrável, não apenas implementado: contrato, cache e erros ficam visíveis na tela.
2. Cache e rate-limit primeiro: as APIs públicas são frágeis e limitadas; o BFF absorve isso antes do browser.
3. Degradar com honestidade: limitação de plano vira estado de UI (aviso, indisponível), nunca dado fabricado.
4. Um só codebase: SSR e endpoints HTTP compartilham a mesma camada de dados.
