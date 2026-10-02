import { Suspense } from "react";
import { TopBar } from "@/components/dashboard/top-bar";
import { KpiCards, KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";
import { MarketOverviewSection } from "@/components/dashboard/market-overview";
import { SelectionProvider } from "@/components/dashboard/selection";
import { Screener } from "@/components/dashboard/screener";
import { MacroSectionArea } from "@/components/dashboard/macro-panel";
import {
  MacroSkeleton,
  OverviewSkeleton,
} from "@/components/dashboard/skeletons";
import { BffContract } from "@/components/dashboard/bff-contract";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-6 md:px-6">
        <Suspense fallback={<KpiCardsSkeleton />}>
          <KpiCards />
        </Suspense>

        <SelectionProvider>
          <Suspense fallback={<OverviewSkeleton />}>
            <MarketOverviewSection />
          </Suspense>
          <Screener />
        </SelectionProvider>

        <Suspense fallback={<MacroSkeleton />}>
          <MacroSectionArea />
        </Suspense>

        <BffContract />

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Dados:{" "}
            <a
              href="https://brapi.dev"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              brapi.dev
            </a>{" "}
            (ações B3) ·{" "}
            <a
              href="https://dadosabertos.bcb.gov.br"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              BCB SGS
            </a>{" "}
            (macro). Sem chave, a brapi atende os tickers de teste — configure{" "}
            <span className="font-mono">BRAPI_API_KEY</span> para histórico
            completo. POC técnica; não é recomendação de investimento.
          </p>
        </footer>
      </main>
    </>
  );
}
