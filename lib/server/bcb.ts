import { BCB_SGS_BASE_URL } from "./config";
import { cached, type BffResult } from "./cache";
import { BffError, isBffError } from "./errors";

/**
 * Séries SGS do Banco Central (grátis, sem chave):
 * - 1178  Selic anualizada base 252 (% a.a., diária)
 * - 4189  Selic acumulada no mês anualizada (% a.a., mensal)
 * - 13522 IPCA 12 meses acumulados (% , mensal)
 * - 1     Taxa de câmbio USD/BRL (compra PTAX, diária)
 */
export const SGS = {
  selic: 1178,
  selicMesAnualizado: 4189,
  ipca12m: 13522,
  usd: 1,
} as const;

const SGS_CACHE = { freshMs: 6 * 60 * 60_000, staleMs: 24 * 60 * 60_000 };const USD_CACHE = { freshMs: 60 * 60_000, staleMs: 6 * 60 * 60_000 };

function parseSgs(json: unknown): MacroPoint[] {
  if (!Array.isArray(json)) {
    throw new BffError("UPSTREAM_ERROR", "Resposta inesperada do SGS/BCB.", 502);
  }
  const points: MacroPoint[] = [];
  for (const raw of json) {
    if (typeof raw !== "object" || raw === null) continue;
    const { data, valor } = raw as { data?: unknown; valor?: unknown };
    if (typeof data !== "string" || typeof valor !== "string") continue;
    const [day, month, year] = data.split("/");
    if (!day || !month || !year) continue;
    const value = Number(valor.replace(",", "."));
    if (Number.isNaN(value)) continue;
    points.push({ date: `${year}-${month}-${day}`, value });
  }
  if (points.length === 0) {
    throw new BffError("UPSTREAM_ERROR", "SGS/BCB retornou série vazia.", 502);
  }
  return points;
}

async function fetchSgs(
  code: number,
  points: number,
  opts = SGS_CACHE,
): Promise<BffResult<MacroPoint[]>> {
  // O SGS rejeita "ultimos" acima de 20 (400 SGSNegocioException).
  const count = Math.min(points, 20);
  const url = `${BCB_SGS_BASE_URL}/bcdata.sgs.${code}/dados/ultimos/${count}?formato=json`;

  return cached(
    `bcb:sgs:${code}:${count}`,
    async () => {
      // O SGS ocasionalmente segura ou derruba conexões em rajada; uma repetição
      // com backoff curto cobre o caso transitório sem inflar o TTL do cache.
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const response = await fetch(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) {
            throw new BffError(
              "UPSTREAM_ERROR",
              `BCB SGS respondeu ${response.status}.`,
              502,
              undefined,
            );
          }
          return parseSgs(await response.json());
        } catch (e) {
          lastError = e;
          const retryable =
            !isBffError(e) || e.status >= 500 || e.status === 429;
          if (!retryable) throw e;
        }
      }
      if (isBffError(lastError)) throw lastError;
      const message = lastError instanceof Error ? lastError.message : "Falha de rede";
      throw new BffError("UPSTREAM_ERROR", `BCB SGS indisponível: ${message}`, 504);
    },
    opts,
  );
}

export type { MacroPoint, MacroSnapshot } from "../types";

import type { MacroPoint, MacroSnapshot } from "../types";

/** @see MacroSnapshot — definição compartilhada em lib/types.ts */

export async function getMacro(): Promise<BffResult<MacroSnapshot>> {
  const [selic, selicMes, ipca, usd] = await Promise.all([
    fetchSgs(SGS.selic, 1),
    fetchSgs(SGS.selicMesAnualizado, 12),
    fetchSgs(SGS.ipca12m, 12),
    fetchSgs(SGS.usd, 31, USD_CACHE),
  ]);

  const last = (r: BffResult<MacroPoint[]>): MacroPoint => {
    const point = r.data[r.data.length - 1];
    if (!point) throw new BffError("UPSTREAM_ERROR", "Série SGS vazia.", 502);
    return point;
  };

  const usdPoints = usd.data;
  const usdNow = last(usd);
  const usdPrev = usdPoints[usdPoints.length - 2];
  const usdChangePercent =
    usdPrev && usdPrev.value !== 0
      ? ((usdNow.value - usdPrev.value) / usdPrev.value) * 100
      : null;

  const results = [selic, selicMes, ipca, usd];
  const allHit = results.every((r) => r.status === "HIT");
  const anyMiss = results.some((r) => r.status === "MISS");

  return {
    data: {
      selic: last(selic),
      ipca12m: last(ipca),
      usd: usdNow,
      usdChangePercent,
      timeline: { selic: selicMes.data, ipca: ipca.data },
      usdSeries: usdPoints.slice(-20),
    },
    status: allHit ? "HIT" : anyMiss ? "MISS" : "STALE",
    fetchMs: results.reduce((acc, r) => acc + r.fetchMs, 0),
    ageSeconds: Math.min(...results.map((r) => r.ageSeconds)),
  };
}
