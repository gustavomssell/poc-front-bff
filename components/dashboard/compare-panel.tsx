"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { CircleAlertIcon, XIcon } from "lucide-react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonthLabel, formatNumber, formatShortDate } from "@/lib/format";
import { apiGet, ApiError } from "@/lib/client/api";
import type { CompareResult, HttpMeta } from "@/lib/types";
import { ContractLine } from "./bits";

const PALETTE = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
];

type ResultState = {
  status: "ready";
  rows: Record<string, string | number | null>[];
  seriesSymbols: string[];
  unavailable: CompareResult["unavailable"];
  meta: HttpMeta;
};

export function ComparePanel({
  symbols,
  onRemove,
}: {
  symbols: string[];
  onRemove: (symbol: string) => void;
}) {
  const [result, setResult] = useState<
    | { key: string; state: ResultState }
    | { key: string; state: { status: "error"; message: string } }
    | null
  >(null);
  const [nonce, setNonce] = useState(0);
  const key = [...symbols].sort().join(",");
  const requestKey = `${key}:${nonce}`;

  useEffect(() => {
    const controller = new AbortController();

    apiGet<CompareResult>(
      `/api/compare?symbols=${encodeURIComponent(key)}&range=1m`,
      { signal: controller.signal },
    )
      .then((res) => {
        const { series, unavailable } = res.data;

        const normalized = series.map((s) => {
          const points = s.points
            .map((p) => ({ date: p.date, value: p.adjustedClose ?? p.close }))
            .filter((p): p is { date: string; value: number } => p.value != null);
          const base = points[0]?.value ?? 1;
          return {
            symbol: s.symbol,
            map: new Map(
              points.map((p) => [p.date, (p.value / base) * 100]),
            ),
          };
        });

        const dates = [
          ...new Set(series.flatMap((s) => s.points.map((p) => p.date))),
        ].sort();

        const rows = dates.map((date) => {
          const row: Record<string, string | number | null> = { date };
          for (const s of normalized) row[s.symbol] = s.map.get(date) ?? null;
          return row;
        });

        setResult({
          key: requestKey,
          state: {
            status: "ready",
            rows,
            seriesSymbols: series.map((s) => s.symbol),
            unavailable,
            meta: res.meta,
          },
        });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({
          key: requestKey,
          state: {
            status: "error",
            message:
              e instanceof ApiError
                ? e.message
                : "Falha inesperada na comparação.",
          },
        });
      });

    return () => controller.abort();
  }, [requestKey, key]);

  const state: ResultState | { status: "error"; message: string } | { status: "loading" } =
    result?.key === requestKey
      ? result.state
      : { status: "loading" };

  const config: ChartConfig = Object.fromEntries(
    symbols.map((s, i) => [
      s,
      { label: s, color: PALETTE[i % PALETTE.length] },
    ]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h3 className="font-heading text-sm font-medium">
            Comparação — base 100
          </h3>
          <p className="text-[11px] text-muted-foreground">
            normalizado no primeiro pregão de 1 mês
          </p>
        </div>
        {symbols.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onRemove(s)}
            className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1.5 pl-2 font-mono text-[11px] hover:bg-muted"
            aria-label={`Remover ${s} da comparação`}
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            {s}
            <XIcon className="size-3 text-muted-foreground" />
          </button>
        ))}
      </div>

      {state.status === "loading" ? (
        <Skeleton className="h-[260px] w-full rounded-lg" />
      ) : state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Comparação indisponível</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => setNonce((n) => n + 1)}>
              Tentar de novo
            </Button>
          </AlertAction>
        </Alert>
      ) : state.seriesSymbols.length === 0 ? (
        <Alert>
          <CircleAlertIcon />
          <AlertTitle>Nada para comparar</AlertTitle>
          <AlertDescription>
            {state.unavailable.map((u) => u.symbol).join(", ")} — sem chave, a
            brapi atende apenas os tickers de teste (PETR4, VALE3, MGLU3, ITUB4,
            MXRF11, HGLG11).
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {state.unavailable.length > 0 ? (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>Comparação parcial</AlertTitle>
              <AlertDescription>
                {state.unavailable.map((u) => u.symbol).join(", ")} ficaram de
                fora — {state.unavailable[0]?.message}
              </AlertDescription>
            </Alert>
          ) : null}
          <ChartContainer config={config} className="h-[260px] w-full">
            <LineChart data={state.rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
                minTickGap={40}
                tickFormatter={(v: string) => formatShortDate(v)}
                fontSize={11}
              />
              <YAxis
                orientation="right"
                width={44}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tickFormatter={(v: number) => formatNumber(v, 0)}
                fontSize={11}
                domain={["auto", "auto"]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => formatMonthLabel(String(label))}
                    formatter={(value) => formatNumber(Number(value), 1)}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {state.seriesSymbols.map((s, i) => (
                <Line
                  key={s}
                  dataKey={s}
                  type="monotone"
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
          <ContractLine
            cache={state.meta.cache}
            generatedAt={state.meta.generatedAt}
            sources={["brapi"]}
          />
        </>
      )}
    </div>
  );
}
