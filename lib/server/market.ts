export const SP_TIME_ZONE = "America/Sao_Paulo";

export type MarketStatus = {
  open: boolean;
  label: string;
  hint: string;
};

/**
 * Status do pregão da B3: sessão contínua 10:00–17:00 (horário de Brasília),
 * dias úteis. Não há intervalo de almoço desde 2009.
 */
export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SP_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const minutes = hour * 60 + minute;

  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const opensAt = 10 * 60;
  const closesAt = 17 * 60;

  if (isWeekend) {
    return {
      open: false,
      label: "Fechado",
      hint: "Bolsa fechada no fim de semana",
    };
  }

  if (minutes < opensAt) {
    return {
      open: false,
      label: "Pré-mercado",
      hint: "Abre às 10:00 (BRT)",
    };
  }

  if (minutes < closesAt) {
    return {
      open: true,
      label: "Aberto",
      hint: "Pregão contínuo até 17:00 (BRT)",
    };
  }

  return {
    open: false,
    label: "Fechado",
    hint: "Abre amanhã às 10:00 (BRT)",
  };
}
