import { BffError, isBffError, toBffError } from "./errors";
import { errorResponse } from "./http";
import { log } from "./log";
import { checkRateLimit, clientKey } from "./rate-limit";

/**
 * Envelope único das rotas `/api`: rate limit por IP, log estruturado e
 * mapeamento de qualquer throw para o contrato `{ error: { code, message } }`.
 *
 * Toda rota deve ser `handleApi(request, async () => ...)`. As rotas podem
 * simplesmente lançar `BffError` — o wrapper cuida do restante.
 */
export async function handleApi(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  const ip = clientKey(request);
  const started = performance.now();

  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    const error = new BffError(
      "RATE_LIMITED",
      `Limite de ${limit.limit} requisições por minuto excedido. Tente novamente em ${limit.retryAfterSeconds}s.`,
      429,
      limit.retryAfterSeconds,
    );
    const res = errorResponse(error);
    res.headers.set("x-ratelimit-limit", String(limit.limit));
    res.headers.set("x-ratelimit-remaining", "0");
    log("warn", "bff.rate_limited", {
      path,
      ip,
      limit: limit.limit,
      retryAfterSeconds: limit.retryAfterSeconds,
    });
    return res;
  }

  const meta = () => ({
    path,
    ip,
    ms: Math.round(performance.now() - started),
    rateRemaining: limit.remaining,
  });

  try {
    const res = await handler();
    res.headers.set("x-ratelimit-limit", String(limit.limit));
    res.headers.set("x-ratelimit-remaining", String(limit.remaining));
    log("info", "bff.request", {
      ...meta(),
      status: res.status,
      cache: res.headers.get("x-bff-cache"),
      upstreamMs: res.headers.get("x-bff-upstream-ms"),
    });
    return res;
  } catch (e) {
    const error = isBffError(e) ? e : toBffError(e);
    const res = errorResponse(error);
    log("error", "bff.request_failed", {
      ...meta(),
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return res;
  }
}
