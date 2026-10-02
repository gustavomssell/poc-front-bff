const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const compact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return brl.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${percent.format(value)}%`;
}

/** R$ 672,4 bi · R$ 5,3 mi */
export function formatCompactBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `R$ ${compact.format(value)}`;
}

/** 27,6 mi · 980,1 mil */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return compact.format(value);
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function changeClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400";
}

/** "02/10/2026" a partir de ISO "2026-10-02". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "out 26" */
export function formatMonthLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
}

/** "02/10" */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}
