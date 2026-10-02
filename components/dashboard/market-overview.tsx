import { getWatchlistSection } from "@/lib/server/dashboard";
import { MarketOverviewClient } from "./market-overview-client";

export async function MarketOverviewSection() {
  const { data, meta } = await getWatchlistSection();

  return (
    <section
      id="overview"
      aria-label="Watchlist e detalhe do ativo"
      className="scroll-mt-20"
    >
      <MarketOverviewClient section={data} meta={meta} />
    </section>
  );
}
