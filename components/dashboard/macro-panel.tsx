import { getMacroSection } from "@/lib/server/dashboard";
import { MacroCharts } from "./macro-charts";

export async function MacroSectionArea() {
  const { data, meta } = await getMacroSection();

  return (
    <section aria-label="Indicadores macroeconômicos">
      <MacroCharts macro={data} meta={meta} />
    </section>
  );
}
