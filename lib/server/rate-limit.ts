import { BFF_RATE_LIMIT_MAX, BFF_RATE_LIMIT_WINDOW_MS } from "./config";
import { BffError } from "./errors";

/**
 * Rate limit fixo por IP, em memória (uma janela por bucket).
 *
 * Motivo de ser em memória e não no Data Cache: o limite é por instância e
 * por processo, o suficiente para proteger o BFF dos upstreams públicos
 * (20 req/min sem chave) e para tornar abuso óbvio no log. Em múltiplas
 * instâncias o limite efetivo multiplica pelo nº de réplicas — aceitável
 * para a POC; em produção trocar por Redis/Limiter gerenciado.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

export type RateLimitResult =
  | { ok: true; limit: number; remaining: number }
  | { ok: false; limit: number; retryAfterSeconds: number };

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  const limit = BFF_RATE_LIMIT_MAX;

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    pruneIfNeeded(now);
    bucket = { count: 0, resetAt: now + BFF_RATE_LIMIT_WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, limit, remaining: limit - bucket.count };
}

/** IP do cliente: X-Forwarded-For (proxy) > X-Real-IP > fallback local. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "local";
}

/** Aplica o limite e devolve um BffError 429 (ou null se passou). */
export function enforceRateLimit(request: Request, now = Date.now()): BffError | null {
  const result = checkRateLimit(clientKey(request), now);
  if (result.ok) return null;
  return new BffError(
    "RATE_LIMITED",
    `Limite de ${result.limit} requisições por minuto excedido. Tente novamente em ${result.retryAfterSeconds}s.`,
    429,
    result.retryAfterSeconds,
  );
}

export function resetRateLimit(): void {
  buckets.clear();
}

function pruneIfNeeded(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
