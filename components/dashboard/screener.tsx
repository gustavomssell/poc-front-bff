"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpDownIcon,
  ChartLineIcon,
  CircleAlertIcon,
  SearchIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { cn } from "cn";
import { formatBRL, formatCompact } from "@/lib/format";
import { apiGet, ApiError } from "@/lib/client/api";
import type { HttpMeta, MarketFacets, MarketPage, MarketRow } from "@/lib/types";
import { useSelection } from "./selection";
import { ChangeBadge, ContractLine, TickerLogo } from "./bits";
import { ComparePanel } from "./compare-panel";

const TYPE_LABELS: Record<string, string> = {
  stock: "Ações",
  fund: "FIIs",
  etf: "ETFs",
  bdr: "BDRs",
  fracao: "Fracionário",
  unit: "Units",
};

const SORT_OPTIONS: Record<string, string> = {
  volume: "Volume",
  change: "Variação",
  marketCap: "Valor de mercado",
  close: "Preço",
  symbol: "Símbolo",
  name: "Nome",
};

const MAX_COMPARE = 4;
const PAGE_SIZE = 20;

function typeLabel(value: string): string {
  return TYPE_LABELS[value] ?? value;
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

type FetchStatus = "loading" | "ready" | "error";

type MarketData = {
  items: MarketRow[];
  facets: MarketFacets | null;
  total: number;
  hasNext: boolean;
  meta: HttpMeta;
};

export function Screener() {
  const { select } = useSelection();

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);
  const [type, setType] = useState("all");
  const [subType, setSubType] = useState("all");
  const [sector, setSector] = useState("all");
  const [sort, setSort] = useState("volume");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const appendRef = useRef(false);

  const [data, setData] = useState<MarketData | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );

  const [compare, setCompare] = useState<string[]>([]);

  const filtersKey = JSON.stringify({
    debouncedQ,
    type,
    subType,
    sector,
    sort,
    order,
  });
  const requestKey = `${filtersKey}:p${page}:${nonce}`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (type !== "all") params.set("type", type);
    if (subType !== "all") params.set("subType", subType);
    if (sector !== "all") params.set("sector", sector);
    params.set("sort", sort);
    params.set("order", order);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));

    apiGet<MarketPage>(`/api/market?${params}`, { signal: controller.signal })
      .then((res) => {
        setData((prev) => ({
          items:
            appendRef.current && page > 1 && prev
              ? [...prev.items, ...res.data.items]
              : res.data.items,
          facets: res.data.facets,
          total: res.data.totalItems,
          hasNext: res.data.hasNextPage,
          meta: res.meta,
        }));
        setLoadedKey(requestKey);
        setFailure(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFailure({
          key: requestKey,
          message:
            e instanceof ApiError
              ? e.message
              : "Falha inesperada ao buscar o mercado.",
        });
      });

    return () => controller.abort();
  }, [
    requestKey,
    debouncedQ,
    type,
    subType,
    sector,
    sort,
    order,
    page,
  ]);

  const status: FetchStatus =
    failure?.key === requestKey
      ? "error"
      : loadedKey === requestKey
        ? "ready"
        : "loading";
  const error = failure?.key === requestKey ? failure.message : "";

  const items = data?.items ?? [];
  const facets = data?.facets ?? null;
  const meta = data?.meta ?? null;
  const total = data?.total ?? 0;
  const hasNext = data?.hasNext ?? false;
  const showSkeleton = status === "loading" && items.length === 0;

  const resetFilters = (apply: () => void) => {
    apply();
    appendRef.current = false;
    setPage(1);
  };

  const loadMore = () => {
    appendRef.current = true;
    setPage((p) => p + 1);
  };

  const toggleCompare = (symbol: string) => {
    setCompare((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, symbol];
    });
  };

  const openInChart = (symbol: string) => {
    select(symbol);
    document
      .getElementById("overview")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Explorar a B3</CardTitle>
        <span className="text-xs text-muted-foreground">
          Busque, filtre e ordene entre centenas de tickers — dados vêm de{" "}
          <span className="font-mono text-[11px]">GET /api/market</span>
        </span>
        <CardAction>
          {meta ? (
            <ContractLine
              cache={meta.cache}
              generatedAt={meta.generatedAt}
              sources={["brapi"]}
            />
          ) : null}
        </CardAction>
      </CardHeader>

      <div className="flex flex-wrap items-center gap-2 px-4">
        <div className="relative w-full sm:w-64">
          <SearchIcon
            aria-hidden
            className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={q}
            onChange={(e) => resetFilters(() => setQ(e.target.value))}
            placeholder="Buscar símbolo ou nome…"
            aria-label="Buscar ticker"
            className="h-8 pl-8"
          />
        </div>

        <Select
          value={type}
          onValueChange={(v) => resetFilters(() => setType(v))}
        >
          <SelectTrigger className="h-8 w-[128px]" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(facets?.assetTypes ?? []).map((t) => (
              <SelectItem key={t} value={t}>
                {typeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sector}
          onValueChange={(v) => resetFilters(() => setSector(v))}
        >
          <SelectTrigger className="h-8 w-[150px]" aria-label="Filtrar por setor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {(facets?.sectors ?? []).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={subType}
          onValueChange={(v) => resetFilters(() => setSubType(v))}
        >
          <SelectTrigger className="h-8 w-[140px]" aria-label="Filtrar por subtipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os subtipos</SelectItem>
            {(facets?.subTypes ?? []).map((s) => (
              <SelectItem key={s} value={s}>
                {typeLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Select
            value={sort}
            onValueChange={(v) => resetFilters(() => setSort(v))}
          >
            <SelectTrigger className="h-8 w-[168px]" aria-label="Ordenar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={
              order === "desc"
                ? "Ordenação decrescente — clique para alternar"
                : "Ordenação crescente — clique para alternar"
            }
            onClick={() => resetFilters(() => setOrder((o) => (o === "desc" ? "asc" : "desc")))}
          >
            <ArrowUpDownIcon
              className={cn("size-3.5", order === "asc" && "rotate-180")}
            />
          </Button>
        </div>
      </div>

      <CardContent>
        {status === "error" ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Não foi possível listar o mercado</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button size="xs" variant="outline" onClick={() => setNonce((n) => n + 1)}>
                Tentar de novo
              </Button>
            </AlertAction>
          </Alert>
        ) : showSkeleton ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-4" />
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyTitle>Nenhum ticker encontrado</EmptyTitle>
            <EmptyDescription>
              Nada bate com &ldquo;{q}&rdquo; nos filtros atuais. Ajuste a busca ou
              limpe os filtros.
            </EmptyDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                resetFilters(() => {
                  setQ("");
                  setType("all");
                  setSubType("all");
                  setSector("all");
                })
              }
            >
              Limpar filtros
            </Button>
          </Empty>
        ) : (
          <>
            <Table className="max-sm:[&_td]:p-1 max-sm:[&_th]:h-9 max-sm:[&_th]:px-1">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">Comparar</span>
                  </TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Volume
                  </TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Valor de mkt
                  </TableHead>
                  <TableHead className="text-right">Gráfico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const checked = compare.includes(row.symbol);
                  const disabled = !checked && compare.length >= MAX_COMPARE;
                  return (
                    <TableRow key={row.symbol} data-row>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          aria-label={`Comparar ${row.symbol}`}
                          onCheckedChange={() => toggleCompare(row.symbol)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex min-w-0 items-center gap-2">
                          <TickerLogo src={row.logoUrl} alt={row.symbol} />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium">
                              {row.symbol}
                            </span>
                            <span className="block max-w-[10ch] truncate text-[11px] text-muted-foreground sm:max-w-[20ch]">
                              {row.name}
                              {row.sector ? ` · ${row.sector}` : ""}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">
                        {formatBRL(row.lastPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChangeBadge value={row.changePercent} className="text-xs" />
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums text-muted-foreground sm:table-cell">
                        {formatCompact(row.volume)}
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums text-muted-foreground md:table-cell">
                        {row.marketCap != null
                          ? `R$ ${formatCompact(row.marketCap)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => openInChart(row.symbol)}
                          aria-label={`Ver gráfico de ${row.symbol} na watchlist`}
                        >
                          <ChartLineIcon data-icon="inline-start" />
                          <span className="max-sm:hidden">Ver</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {items.length} de {total.toLocaleString("pt-BR")} resultados
                {compare.length > 0
                  ? ` · ${compare.length} selecionado(s) para comparação`
                  : ""}
              </p>
              {hasNext ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Carregando…" : "Carregar mais"}
                </Button>
              ) : null}
            </div>

            {compare.length >= 2 ? (
              <div className="mt-4 border-t pt-4">
                <ComparePanel
                  symbols={compare}
                  onRemove={(s) => toggleCompare(s)}
                />
              </div>
            ) : compare.length === 1 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Selecione ao menos mais um ativo para comparar (até{" "}
                {MAX_COMPARE}).
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
