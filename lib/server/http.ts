import { isBffError, toBffError } from "./errors";
import type { CacheStatus } from "./cache";
import type { HttpMeta } from "../types";

export type { HttpMeta };

export function metaFromResult(
  source: "brapi" | "bcb",
  result: { status: CacheStatus; fetchMs: number; ageSeconds: number },
): HttpMeta {
  return {
    generatedAt: new Date().toISOString(),
    cache: result.status,
    sources: [{ source, status: result.status, fetchMs: result.fetchMs }],
    ageSeconds: result.ageSeconds,
    fetchMs: result.fetchMs,
  };
}

export function jsonResponse(data: unknown, meta: HttpMeta, status = 200): Response {
  const upstreamMs = meta.fetchMs ?? meta.sources.reduce((acc, s) => acc + s.fetchMs, 0);
  return Response.json(
    { data, meta },
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-bff-cache": meta.cache,
        "x-bff-generated-at": meta.generatedAt,
        "x-bff-upstream-ms": String(upstreamMs),
        "cache-control": "no-store",
      },
    },
  );
}

export function errorResponse(e: unknown): Response {
  const error = isBffError(e) ? e : toBffError(e);
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (error.retryAfter) headers["retry-after"] = String(error.retryAfter);

  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers },
  );
}
