"use client";

import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { CircleAlertIcon } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  formatBRL,
  formatCompact,
  formatDate,
  formatNumber,
  formatShortDate,
} from "@/lib/format";
import { apiGet, ApiError } from "@/lib/client/api";
import type {
  HistoryPoint,
  HistorySeries,
  HttpMeta,
  Quote,
} from "@/lib/types";
import { ChangeBadge, ContractLine, TickerLogo } from "./bits";
import { cn } from "cn";

export const HISTORY_RANGE_LABELS = {
  "1m": "1 mês",
  "3m": "3 meses",
  "6m": "6 meses",
  "1y": "1 ano",
} as const;

type Range = "1m" | "3m" | "6m" | "1y";

type ResultState =
  | { status: "ready"; points: HistoryPoint[]; meta: HttpMeta }
  | { status: "error"; message: string };

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-medium tabular-nums">{value}</p>
    </div>
  );
}

export function PriceChartPanel({
  quote,
  symbol,
}: {
  quote: Quote | null;
  symbol: string | null;
}) {
  const gradientId = useId();
  const [range, setRange] = useState<Range>("1m");
  const [result, setResult] = useState<{ key: string; state: ResultState } | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);
  const requestKey = `${symbol ?? ""}:${range}:${nonce}`;

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();

    apiGet<HistorySeries>(
      `/api/history/${encodeURIComponent(symbol)}?range=${range}`,
      { signal: controller.signal },
    )
      .then((res) =>
        setResult({
          key: requestKey,
          state: { status: "ready", points: res.data.points, meta: res.meta },
        }),
      )
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({
          key: requestKey,
          state: {
            status: "error",
            message:
              e instanceof ApiError
                ? e.message
                : "Falha inesperada ao buscar o histórico.",
          },
        });
      });

    return () => controller.abort();
  }, [requestKey, symbol, range]);

  if (!quote || !symbol) {
    return (
      <Card>
        <Empty>
          <EmptyTitle>Nenhum ativo selecionado</EmptyTitle>
          <EmptyDescription>
            Escolha um papel na watchlist para ver o histórico.
          </EmptyDescription>
        </Empty>
      </Card>
    );
  }

  const state: ResultState | { status: "loading" } =
    result?.key === requestKey ? result.state : { status: "loading" };

  const position52w =
    quote.week52High > quote.week52Low
      ? Math.min(
          100,
          Math.max(
            0,
            ((quote.price - quote.week52Low) /
              (quote.week52High - quote.week52Low)) *
              100,
          ),
        )
      : 50;

  const chartUp =
    state.status === "ready" && state.points.length > 1
      ? (state.points[state.points.length - 1].adjustedClose ??
          state.points[state.points.length - 1].close ??
          0) >=
        (state.points[0].adjustedClose ?? state.points[0].close ?? 0)
      : true;
  const lineColor = chartUp ? "var(--chart-up)" : "var(--chart-down)";

  const chartData =
    state.status === "ready"
      ? state.points
          .map((p) => ({ date: p.date, close: p.adjustedClose ?? p.close }))
          .filter((p): p is { date: string; close: number } => p.close != null)
      : [];

  const config = {
    close: { label: "Fechamento", color: lineColor },
  } satisfies ChartConfig;

  return (
    <Card className="gap-3">
      <div className="flex flex-wrap items-center gap-3 px-4">
        <TickerLogo src={quote.logoUrl} alt={quote.symbol} className="size-9" />
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold">{quote.symbol}</p>
          <p className="max-w-[30ch] truncate text-xs text-muted-foreground">
            {quote.name}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatBRL(quote.price)}
          </p>
          <p className="flex items-center justify-end gap-2 text-xs">
            <ChangeBadge value={quote.changePercent} />
            <span className="tabular-nums text-muted-foreground">
              {formatBRL(quote.change)}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-2 px-4 sm:grid-cols-6">
        <Metric label="Abertura" value={formatBRL(quote.open)} />
        <Metric label="Máxima" value={formatBRL(quote.high)} />
        <Metric label="Mínima" value={formatBRL(quote.low)} />
        <Metric label="Fech. anterior" value={formatBRL(quote.prevClose)} />
        <Metric label="Volume" value={formatCompact(quote.volume)} />
        <Metric
          label="Valor de mkt"
          value={
            quote.marketCap != null ? `R$ ${formatCompact(quote.marketCap)}` : "—"
          }
        />
      </div>

      <div className="px-4">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">52s mín {formatBRL(quote.week52Low)}</span>
          <span className="tabular-nums">máx {formatBRL(quote.week52High)}</span>
        </div>
        <div className="relative mt-1 h-1.5 rounded-full bg-muted">
          <span
            aria-hidden
            className="absolute -top-0.5 h-2.5 w-1 rounded-full bg-foreground"
            style={{ left: `calc(${position52w}% - 2px)` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={range}
          onValueChange={(v) => {
            if (v) setRange(v as Range);
          }}
          aria-label="Período do histórico"
        >
          {(Object.keys(HISTORY_RANGE_LABELS) as Range[]).map((r) => (
            <ToggleGroupItem key={r} value={r} aria-label={HISTORY_RANGE_LABELS[r]}>
              {HISTORY_RANGE_LABELS[r]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {state.status === "ready" ? (
          <ContractLine
            cache={state.meta.cache}
            generatedAt={state.meta.generatedAt}
            sources={["brapi"]}
          />
        ) : null}
      </div>

      <CardContent className="min-h-[300px]">
        {state.status === "loading" ? (
          <Skeleton className="h-[300px] w-full rounded-lg" />
        ) : state.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Histórico indisponível</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
            <AlertAction>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setNonce((n) => n + 1)}
              >
                Tentar de novo
              </Button>
            </AlertAction>
          </Alert>
        ) : chartData.length === 0 ? (
          <Empty className="min-h-[300px]">
            <EmptyTitle>Sem pregões na janela</EmptyTitle>
            <EmptyDescription>
              A fonte não retornou pontos para {symbol} em {HISTORY_RANGE_LABELS[range]}.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="flex h-[300px] flex-col gap-1">
            <ChartContainer config={config} className="h-full w-full">
              <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={36}
                  tickFormatter={(v: string) => formatShortDate(v)}
                  fontSize={11}
                />
                <YAxis
                  orientation="right"
                  width={62}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tickFormatter={(v: number) => formatNumber(v, 2)}
                  fontSize={11}
                  domain={["auto", "auto"]}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      nameKey="close"
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value) => formatBRL(Number(value))}
                    />
                  }
                />
                <Area
                  dataKey="close"
                  type="monotone"
                  stroke={lineColor}
                  strokeWidth={1.75}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
            <p
              className={cn(
                "text-right text-[11px] text-muted-foreground tabular-nums",
              )}
            >
              {chartData.length} pregões · {HISTORY_RANGE_LABELS[range]}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
