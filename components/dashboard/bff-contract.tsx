"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BracesIcon,
  CircleAlertIcon,
  CopyIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, ApiError, type ClientEnvelope } from "@/lib/client/api";
import type { DashboardPayload } from "@/lib/types";
import { SectionErrors } from "./section-errors";

type FetchState =
  | { status: "loading" }
  | { status: "ready"; envelope: ClientEnvelope<DashboardPayload> }
  | { status: "error"; message: string };

function buildPreview(envelope: ClientEnvelope<DashboardPayload>) {
  const { data } = envelope;
  return {
    data: {
      market: data.market,
      kpis: {
        selic: data.kpis.selic,
        ipca12m: data.kpis.ipca12m,
        usd: data.kpis.usd,
        gainers: `${data.kpis.gainers.length} linhas`,
        losers: `${data.kpis.losers.length} linhas`,
      },
      watchlist: {
        quotes: data.watchlist.quotes.map((q) => ({
          symbol: q.symbol,
          price: q.price,
          changePercent: q.changePercent,
        })),
        sparklines: `${data.watchlist.sparklines.length} séries`,
        unavailable: data.watchlist.unavailable,
      },
      macro: data.macro ? "MacroSnapshot" : null,
    },
    meta: envelope.meta,
  };
}

export function BffContract() {
  const [result, setResult] = useState<{
    nonce: number;
    envelope: ClientEnvelope<DashboardPayload>;
  } | null>(null);
  const [failure, setFailure] = useState<{ nonce: number; message: string } | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const attempted = nonce;
    apiGet<DashboardPayload>("/api/dashboard")
      .then((envelope) => setResult({ nonce: attempted, envelope }))
      .catch((e: unknown) =>
        setFailure({
          nonce: attempted,
          message:
            e instanceof ApiError
              ? e.message
              : "Falha inesperada ao chamar o BFF.",
        }),
      );
  }, [nonce]);

  const state: FetchState =
    result?.nonce === nonce
      ? { status: "ready", envelope: result.envelope }
      : failure?.nonce === nonce
        ? { status: "error", message: failure.message }
        : { status: "loading" };

  const copy = async () => {
    if (state.status !== "ready") return;
    const full = JSON.stringify(
      { data: state.envelope.data, meta: state.envelope.meta },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Contrato completo copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar. Verifique as permissões do navegador.");
    }
  };

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BracesIcon className="size-4 text-muted-foreground" />
          Contrato BFF
        </CardTitle>
        <CardDescription>
          O que o browser realmente recebe: uma única chamada a{" "}
          <span className="font-mono text-xs">GET /api/dashboard</span> com
          payload + meta de cache. Sem segredos de integração do lado de fora.
        </CardDescription>
        <CardAction className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={copy}
            disabled={state.status !== "ready"}
          >
            <CopyIcon data-icon="inline-start" />
            Copiar JSON
          </Button>
          <Button variant="outline" size="xs" onClick={() => setNonce((n) => n + 1)}>
            <RefreshCwIcon data-icon="inline-start" />
            Repetir chamada
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-[180px] w-full rounded-lg" />
            <span className="text-xs text-muted-foreground">Chamando /api/dashboard…</span>
          </div>
        ) : state.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Endpoint respondeu com erro</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
            <AlertAction>
              <Button size="xs" variant="outline" onClick={() => setNonce((n) => n + 1)}>
                Tentar de novo
              </Button>
            </AlertAction>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-[11px]">
                HTTP 200
              </Badge>
              <Badge variant="outline" className="font-mono text-[11px]">
                x-bff-cache: {state.envelope.raw["x-bff-cache"] ?? state.envelope.meta.cache}
              </Badge>
              <Badge variant="outline" className="font-mono text-[11px]">
                x-bff-upstream-ms: {state.envelope.raw["x-bff-upstream-ms"] ?? "—"}
              </Badge>
              <Badge variant="outline" className="font-mono text-[11px]">
                x-bff-generated-at:{" "}
                {state.envelope.raw["x-bff-generated-at"]?.slice(11, 19) ?? "—"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {state.envelope.meta.sources.map((s, i) => (
                <span key={i} className="font-mono text-[11px]">
                  {s.source} · {s.status ?? "?"} · {s.fetchMs}ms
                </span>
              ))}
              <span className="ml-auto font-mono text-[11px]">
                flags.hasApiKey: {String(state.envelope.meta.flags?.hasApiKey ?? false)}
              </span>
            </div>

            <SectionErrors errors={state.envelope.meta.errors ?? []} />

            <pre
              tabIndex={0}
              className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed tabular-nums"
            >
              {JSON.stringify(buildPreview(state.envelope), null, 2)}
            </pre>
            <p className="text-[11px] text-muted-foreground">
              Prévia reduzida para caber na tela — o botão acima copia o contrato
              completo.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
