import type { CacheStatus } from "../types";

export type { CacheStatus };

export interface BffResult<T> {
  data: T;
  status: CacheStatus;
  /** Tempo gasto chamando a API upstream nesta invocação (0 quando veio do cache). */
  fetchMs: number;
  ageSeconds: number;
}

interface Entry {
  data: unknown;
  fetchedAt: number;
}

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Cache TTL em memória com stale-while-revalidate e single-flight.
 *
 * Por que não o Data Cache do Next: o BFF precisa expor o estado do cache
 * (HIT/STALE/MISS + idade) como parte do contrato HTTP — o Data Cache do
 * framework é opaco. O cache em memória também deduplica requisições
 * concorrentes (single-flight), essencial para respeitar o rate limit de
 * 20 req/min das APIs públicas sem chave.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { freshMs: number; staleMs: number },
): Promise<BffResult<T>> {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && now - entry.fetchedAt < opts.freshMs) {
    return {
      data: entry.data as T,
      status: "HIT",
      fetchMs: 0,
      ageSeconds: Math.round((now - entry.fetchedAt) / 1000),
    };
  }

  const isStale = entry && now - entry.fetchedAt < opts.freshMs + opts.staleMs;
  const pending = inflight.get(key);

  if (isStale && !pending) {
    revalidate(key, fetcher).catch(() => {});
    return {
      data: entry.data as T,
      status: "STALE",
      fetchMs: 0,
      ageSeconds: Math.round((now - entry.fetchedAt) / 1000),
    };
  }

  const started = performance.now();
  try {
    const promise = pending ?? revalidate(key, fetcher);
    const data = (await promise) as T;
    return {
      data,
      status: "MISS",
      fetchMs: Math.round(performance.now() - started),
      ageSeconds: 0,
    };
  } catch (e) {
    // Sem dados frescos: se existe entry vencido (stale estourado), serve ele
    // como melhor esforço em vez de propagar o erro imediatamente.
    if (entry) {
      return {
        data: entry.data as T,
        status: "STALE",
        fetchMs: Math.round(performance.now() - started),
        ageSeconds: Math.round((Date.now() - entry.fetchedAt) / 1000),
      };
    }
    throw e;
  }
}

function revalidate(key: string, fetcher: () => Promise<unknown>): Promise<unknown> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetcher()
    .then((data) => {
      store.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function clearCache(): void {
  store.clear();
}

export function cacheSize(): number {
  return store.size;
}
