import { changeClass, formatNumber } from "@/lib/format";
import { cn } from "cn";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import Image from "next/image";

/** Variação do dia com seta e cor — sempre acompanhada de texto, nunca só cor. */
export function ChangeBadge({
  value,
  className,
  digits = 2,
}: {
  value: number | null | undefined;
  className?: string;
  digits?: number;
}) {
  if (value == null || Number.isNaN(value)) {
    return <span className="tabular-nums text-muted-foreground">—</span>;
  }
  const Icon = value >= 0 ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums font-medium",
        changeClass(value),
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {formatNumber(Math.abs(value), digits)}%
    </span>
  );
}

export function TickerLogo({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md bg-muted font-heading text-[9px] font-semibold text-muted-foreground",
          className,
        )}
      >
        {alt.slice(0, 2)}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={24}
      height={24}
      loading="lazy"
      className={cn("size-6 shrink-0 rounded-md bg-background object-contain", className)}
    />
  );
}

/** Sparkline SVG sem dependência: série diária do próprio ativo. */
export function Sparkline({
  points,
  className,
}: {
  points: { date: string; value: number }[];
  className?: string;
}) {
  if (points.length < 2) {
    return <span className={cn("block h-6 w-24", className)} aria-hidden />;
  }

  const w = 96;
  const h = 24;
  const pad = 2;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const up = values[values.length - 1] >= values[0];

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-6 w-24 overflow-visible", className)}
      role="img"
      aria-label={`Tendência ${up ? "de alta" : "de baixa"} nos últimos pregões`}
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={up ? "var(--chart-up)" : "var(--chart-down)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Texto de contrato: status de cache + origem dos dados, em uma linha. */
export function ContractLine({
  cache,
  generatedAt,
  sources,
  className,
}: {
  cache?: string;
  generatedAt?: string;
  sources?: string[];
  className?: string;
}) {
  const time = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("pt-BR", { hour12: false })
    : null;
  return (
    <p
      className={cn(
        "font-mono text-[11px] tabular-nums text-muted-foreground",
        className,
      )}
    >
      {cache ? <span className="text-foreground/80">cache {cache}</span> : null}
      {cache && sources?.length ? " · " : ""}
      {sources?.length ? `fonte ${sources.join("+")}` : null}
      {time ? ` · gerado às ${time}` : null}
    </p>
  );
}
