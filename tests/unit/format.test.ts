import { describe, expect, it } from "vitest";
import {
  changeClass,
  formatBRL,
  formatCompact,
  formatCompactBRL,
  formatDate,
  formatMonthLabel,
  formatNumber,
  formatPercent,
  formatShortDate,
} from "@/lib/format";

/** Intl pt-BR usa NBSP (U+00A0); normaliza para asserções legíveis. */
const text = (s: string) => s.replace(/\u00a0/g, " ");

describe("formatBRL", () => {
  it("formata em moeda brasileira", () => {
    expect(text(formatBRL(1234.5))).toBe("R$ 1.234,50");
  });

  it("retorna travessão para null/undefined/NaN", () => {
    expect(formatBRL(null)).toBe("—");
    expect(formatBRL(undefined)).toBe("—");
    expect(formatBRL(Number.NaN)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("sinal exceto zero", () => {
    expect(formatPercent(1.5)).toBe("+1,50%");
    expect(formatPercent(-2.34)).toBe("-2,34%");
    expect(formatPercent(0)).toBe("0,00%");
  });

  it("retorna travessão para valores ausentes", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
  });
});

describe("formatCompactBRL / formatCompact", () => {
  it("sufixos compactos em pt-BR", () => {
    expect(text(formatCompactBRL(672_400_000_000))).toBe("R$ 672,4 bi");
    expect(text(formatCompactBRL(5_300_000))).toBe("R$ 5,3 mi");
    expect(text(formatCompact(980_100))).toBe("980,1 mil");
    expect(text(formatCompact(27_600_000))).toBe("27,6 mi");
  });

  it("retorna travessão para valores ausentes", () => {
    expect(formatCompactBRL(null)).toBe("—");
    expect(formatCompact(undefined)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("respeita a quantidade de dígitos", () => {
    expect(formatNumber(1234.5678)).toBe("1.234,57");
    expect(formatNumber(1234.5678, 0)).toBe("1.235");
    expect(formatNumber(null)).toBe("—");
  });
});

describe("changeClass", () => {
  it("mapeia variação para classes de cor", () => {
    expect(changeClass(1.2)).toBe("text-emerald-700 dark:text-emerald-400");
    expect(changeClass(-1)).toBe("text-red-700 dark:text-red-400");
    expect(changeClass(0)).toBe("text-muted-foreground");
    expect(changeClass(null)).toBe("text-muted-foreground");
  });
});

describe("datas", () => {
  it("formatDate converte ISO para dd/mm/aaaa", () => {
    expect(formatDate("2026-10-02")).toBe("02/10/2026");
    expect(formatDate("data-invalida")).toBe("data-invalida");
  });

  it("formatMonthLabel gera rótulo curto", () => {
    expect(formatMonthLabel("2026-10-01")).toBe("out 26");
    expect(formatMonthLabel("2026-01-01")).toBe("jan 26");
  });

  it("formatShortDate gera dd/mm", () => {
    expect(formatShortDate("2026-10-02")).toBe("02/10");
  });
});
