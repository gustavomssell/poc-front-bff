import type { ApiEnvelope } from "@/lib/types";

export type ClientEnvelope<T> = ApiEnvelope<T> & {
  raw: Record<string, string | null>;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

/**
 * Chamada client para os endpoints do próprio BFF. Levanta ApiError com o
 * código/mensagem do contrato `{ error: { code, message } }`.
 */
export async function apiGet<T>(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<ClientEnvelope<T>> {
  const res = await fetch(path, {
    headers: { Accept: "application/json" },
    signal: init?.signal,
  });

  const body = (await res.json().catch(() => null)) as (ApiEnvelope<T> & ErrorBody) | null;

  if (!res.ok || body?.error || body?.data === undefined) {
    throw new ApiError(
      body?.error?.message ?? `Falha ao chamar ${path} (HTTP ${res.status}).`,
      body?.error?.code ?? "HTTP_ERROR",
      res.status,
    );
  }

  const raw = {
    "x-bff-cache": res.headers.get("x-bff-cache"),
    "x-bff-generated-at": res.headers.get("x-bff-generated-at"),
    "x-bff-upstream-ms": res.headers.get("x-bff-upstream-ms"),
  };

  return { data: body.data, meta: body.meta, raw };
}
