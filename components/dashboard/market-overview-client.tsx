"use client";

import { TriangleAlertIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { formatBRL, formatCompact } from "@/lib/format";
import type { DashboardMeta, WatchlistSection } from "@/lib/types";
import { useSelection } from "./selection";
import { ChangeBadge, ContractLine, Sparkline, TickerLogo } from "./bits";
import { PriceChartPanel } from "./price-chart";
import { SectionErrors } from "./section-errors";
import { cn } from "cn";

export function MarketOverviewClient({
  section,
  meta,
}: {
  section: WatchlistSection;
  meta: DashboardMeta;
}) {
  const { symbol: selectedFromContext, select } = useSelection();
  const { quotes, sparklines, unavailable } = section;

  const selected =
    selectedFromContext && quotes.some((q) => q.symbol === selectedFromContext)
      ? selectedFromContext
      : (quotes[0]?.symbol ?? null);
  const active = quotes.find((q) => q.symbol === selected) ?? null;
  const sparkBySymbol = new Map(sparklines.map((s) => [s.symbol, s.points]));

  if (quotes.length === 0) {
    return (
      <Card>
        <Empty>
          <EmptyTitle>Watchlist vazia</EmptyTitle>
          <EmptyDescription>
            Nenhuma cotação detalhada retornou. Configure a lista em{" "}
            <span className="font-mono text-xs">BRAPI_WATCHLIST</span> e tente
            de novo.
          </EmptyDescription>
        </Empty>
        <SectionErrors errors={meta.errors} />
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Watchlist</CardTitle>
          <CardAction>
            <ContractLine
              cache={meta.cache}
              generatedAt={meta.generatedAt}
              sources={["brapi"]}
            />
          </CardAction>
        </CardHeader>

        <div className="px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Fechamento</TableHead>
                <TableHead className="text-right">1 dia</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Volume
                </TableHead>
                <TableHead className="hidden text-right lg:table-cell">
                  1 mês
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                const isSelected = q.symbol === selected;
                return (
                  <TableRow
                    key={q.symbol}
                    data-row
                    tabIndex={0}
                    aria-selected={isSelected}
                    className={cn(
                      "cursor-pointer",
                      isSelected && "bg-accent/70 hover:bg-accent",
                    )}
                    onClick={() => select(q.symbol)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(q.symbol);
                      }
                    }}
                  >
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-2">
                        <TickerLogo src={q.logoUrl} alt={q.symbol} />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium">
                            {q.symbol}
                          </span>
                          <span className="block max-w-[10ch] truncate text-[11px] text-muted-foreground sm:max-w-[16ch]">
                            {q.name}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums">
                      {formatBRL(q.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChangeBadge value={q.changePercent} className="text-xs" />
                    </TableCell>
                    <TableCell className="hidden text-right text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {formatCompact(q.volume)}
                    </TableCell>
                    <TableCell className="hidden justify-end lg:table-cell">
                      <Sparkline
                        points={sparkBySymbol.get(q.symbol) ?? []}
                        className="ml-auto"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {unavailable.length > 0 ? (
          <div className="px-4 pb-1">
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>Tickers sem cotação detalhada</AlertTitle>
              <AlertDescription>
                {unavailable.map((u) => u.symbol).join(", ")} —{" "}
                {unavailable[0]?.message} Configure{" "}
                <span className="font-mono text-xs">BRAPI_API_KEY</span> para
                liberar todos os ativos.
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </Card>

      <PriceChartPanel quote={active} symbol={selected} />
    </div>
  );
}
