export type BffErrorCode =
  | "BAD_REQUEST"
  | "REQUIRES_KEY"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR";

export class BffError extends Error {
  constructor(
    public code: BffErrorCode,
    message: string,
    public status = 502,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "BffError";
  }
}

export function isBffError(e: unknown): e is BffError {
  return e instanceof BffError;
}

export function toBffError(e: unknown): BffError {
  if (isBffError(e)) return e;
  const message = e instanceof Error ? e.message : "Erro interno do BFF";
  return new BffError("UPSTREAM_ERROR", message, 500);
}
