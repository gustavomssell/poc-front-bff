import { getKpisSection } from "@/lib/server/dashboard";
import {
  formatBRL,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { SectionErrors } from "./section-errors";
import { ChangeBadge, TickerLogo } from "./bits";
import type { KpisSection, MarketRow } from "@/lib/types";
import { cn } from "cn";

function ValueCard({
  label,
  value,
  unit,
  note,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  delta?: React.ReactNode;
}) {
  return (
    <Card className="gap-1.5">
      <p className="px-4 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-1.5 px-4">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
          {unit ? (
            <span className="ml-0.5 text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </span>
        {delta}
      </div>
      <p className="px-4 text-[11px] text-muted-foreground">{note}</p>
    </Card>
  );
}

function MoverList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: MarketRow[];
  tone: "up" | "down";
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "mb-1.5 text-[11px] font-medium",
          tone === "up"
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-red-700 dark:text-red-400",
        )}
      >
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">Sem dados agora.</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((row, i) => (
            <li
              key={row.symbol}
              className="flex items-center gap-2 border-b border-border/60 py-1.5 last:border-0"
            >
              <span className="w-3 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <TickerLogo src={row.logoUrl} alt={row.symbol} className="size-5" />
              <span className="shrink-0 text-xs font-medium">{row.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {row.name}
              </span>
              <ChangeBadge value={row.changePercent} className="text-xs" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function KpiGrid({ data }: { data: KpisSection }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ValueCard
          label="Selic"
          value={data.selic ? formatNumber(data.selic.value, 2) : "—"}
          unit="%"
          note={
            data.selic
              ? `a.a. (base 252) · até ${formatDate(data.selic.date)}`
              : "BCB SGS 1178 indisponível"
          }
        />
        <ValueCard
          label="IPCA 12 meses"
          value={data.ipca12m ? formatNumber(data.ipca12m.value, 2) : "—"}
          unit="%"
          note={
            data.ipca12m
              ? `acumulado · até ${formatDate(data.ipca12m.date)}`
              : "BCB SGS 13522 indisponível"
          }
        />
        <ValueCard
          label="Dólar"
          value={data.usd ? formatBRL(data.usd.value) : "—"}
          note={
            data.usd
              ? `USD/BRL · ${formatDate(data.usd.date)}`
              : "BCB SGS 1 indisponível"
          }
          delta={
            data.usd ? (
              <ChangeBadge value={data.usd.changePercent} className="text-sm" />
            ) : undefined
          }
        />
      </div>

      <Card className="gap-2">
        <div className="flex items-baseline justify-between gap-2 px-4">
          <h2 className="font-heading text-sm font-medium">
            Maiores movimentos
          </h2>
          <span className="text-[11px] text-muted-foreground">
            ações com volume ≥ 100 mil
          </span>
        </div>
        <CardContent className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <MoverList title="Altas do dia" rows={data.gainers} tone="up" />
          <MoverList title="Baixas do dia" rows={data.losers} tone="down" />
        </CardContent>
      </Card>
    </>
  );
}

export async function KpiCards() {
  const { data, meta } = await getKpisSection();

  const hasAny =
    data.selic != null || data.ipca12m != null || data.usd != null ||
    data.gainers.length > 0 || data.losers.length > 0;

  return (
    <section aria-label="Indicadores do dia" className="flex flex-col gap-3">
      {hasAny ? (
        <KpiGrid data={data} />
      ) : (
        <Empty>
          <EmptyTitle>Sem indicadores disponíveis</EmptyTitle>
          <EmptyDescription>
            As fontes (brapi e BCB SGS) não responderam nesta carga.
          </EmptyDescription>
        </Empty>
      )}
      <SectionErrors errors={meta.errors} />
    </section>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </Card>
        <Card className="gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </Card>
        <Card className="gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-28" />
        </Card>
      </div>
      <Card className="gap-2">
        <Skeleton className="h-4 w-44" />
        <div className="grid gap-x-8 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function formatPercentValue(value: number | null): string {
  return formatPercent(value);
}
