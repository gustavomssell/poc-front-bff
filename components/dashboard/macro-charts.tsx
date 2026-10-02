"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Area,
  AreaChart,
  XAxis,
  YAxis,
} from "recharts";
import { CircleAlertIcon } from "lucide-react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatMonthLabel, formatNumber, formatShortDate } from "@/lib/format";
import type { DashboardMeta, MacroSnapshot, MacroPoint } from "@/lib/types";
import { ContractLine } from "./bits";
import { SectionErrors } from "./section-errors";
const SELIC_COLOR = "var(--chart-selic)";

const IPCA_COLOR = "var(--chart-ipca)";

const USD_COLOR = "var(--chart-usd)";
function mergeTimeline(
  selic: MacroPoint[],
  ipca: MacroPoint[],
): Record<string, string | number | null>[] {
  const selicByDate = new Map(selic.map((p) => [p.date, p.value]));
  const ipcaByDate = new Map(ipca.map((p) => [p.date, p.value]));
  const dates = [...new Set([...selicByDate.keys(), ...ipcaByDate.keys()])].sort();
  return dates.map((date) => ({
    date,
    selic: selicByDate.get(date) ?? null,
    ipca: ipcaByDate.get(date) ?? null,
  }));
}

const timelineConfig = {
  selic: { label: "Selic (% a.a.)", color: SELIC_COLOR },
  ipca: { label: "IPCA 12m (%)", color: IPCA_COLOR },
} satisfies ChartConfig;

const usdConfig = {
  usd: { label: "USD/BRL", color: USD_COLOR },
} satisfies ChartConfig;

export function MacroCharts({
  macro,
  meta,
}: {
  macro: MacroSnapshot | null;
  meta: DashboardMeta;
}) {
  if (!macro) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>BCB SGS indisponível</AlertTitle>
          <AlertDescription>
            Não foi possível carregar Selic, IPCA e dólar. As seções de ações
            continuam funcionando — o BFF degrada por fonte.
          </AlertDescription>
        </Alert>
        <SectionErrors errors={meta.errors} />
      </div>
    );
  }

  const timelineRows = mergeTimeline(macro.timeline.selic, macro.timeline.ipca);
  const usdRows = macro.usdSeries.map((p) => ({ date: p.date, usd: p.value }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Selic × IPCA — 12 meses</CardTitle>
          <CardAction>
            <ContractLine
              cache={meta.cache}
              generatedAt={meta.generatedAt}
              sources={["bcb"]}
            />
          </CardAction>
        </CardHeader>
        <ChartContainer config={timelineConfig} className="h-[260px] w-full px-4">
          <LineChart data={timelineRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
              tickFormatter={(v: string) => formatMonthLabel(v)}
              fontSize={11}
            />
            <YAxis
              orientation="right"
              width={44}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={(v: number) => `${formatNumber(v, 1)}`}
              fontSize={11}
              domain={["auto", "auto"]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => formatMonthLabel(String(label))}
                  formatter={(value) => `${formatNumber(Number(value), 2)}%`}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="selic"
              type="monotone"
              stroke={SELIC_COLOR}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              connectNulls
            />
            <Line
              dataKey="ipca"
              type="monotone"
              stroke={IPCA_COLOR}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
        <p className="px-4 text-[11px] text-muted-foreground">
          SGS 4189 (Selic acumulada no mês anualizada) × SGS 13522 (IPCA 12m)
        </p>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Dólar — últimos 20 pregões</CardTitle>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatBRL(macro.usd.value)}
          </p>
        </CardHeader>
        <ChartContainer config={usdConfig} className="h-[260px] w-full px-4">
          <AreaChart data={usdRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="usd-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={USD_COLOR} stopOpacity={0.22} />
                <stop offset="95%" stopColor={USD_COLOR} stopOpacity={0.02} />
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
              minTickGap={40}
              tickFormatter={(v: string) => formatShortDate(v)}
              fontSize={11}
            />
            <YAxis
              orientation="right"
              width={54}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={(v: number) => formatNumber(v, 3)}
              fontSize={11}
              domain={["auto", "auto"]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => formatShortDate(String(label))}
                  formatter={(value) => formatBRL(Number(value))}
                />
              }
            />
            <Area
              dataKey="usd"
              type="monotone"
              stroke={USD_COLOR}
              strokeWidth={1.75}
              fill="url(#usd-fill)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ChartContainer>
        <p className="px-4 text-[11px] text-muted-foreground">SGS 1 — PTAX diária</p>
      </Card>
    </div>
  );
}
