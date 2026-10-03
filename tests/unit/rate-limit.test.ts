import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let rateLimit: typeof import("@/lib/server/rate-limit");
let config: typeof import("@/lib/server/config");
let BffError: typeof import("@/lib/server/errors").BffError;

const LIMIT = 3;
const WINDOW_MS = 60_000;
const NOW = 1_700_000_000_000;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("BFF_RATE_LIMIT_MAX", String(LIMIT));
  rateLimit = await import("@/lib/server/rate-limit");
  config = await import("@/lib/server/config");
  BffError = (await import("@/lib/server/errors")).BffError;
  rateLimit.resetRateLimit();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/market", { headers });
}

describe("checkRateLimit", () => {
  it("libera até o limite e bloqueia a requisição seguinte", () => {
    for (let i = 1; i <= LIMIT; i++) {
      const res = rateLimit.checkRateLimit("ip-a", NOW);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.remaining).toBe(LIMIT - i);
    }

    const blocked = rateLimit.checkRateLimit("ip-a", NOW);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.limit).toBe(LIMIT);
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("janela expirada zera o contador", () => {
    for (let i = 0; i < LIMIT; i++) {
      expect(rateLimit.checkRateLimit("ip-b", NOW).ok).toBe(true);
    }
    expect(rateLimit.checkRateLimit("ip-b", NOW).ok).toBe(false);

    const afterWindow = rateLimit.checkRateLimit("ip-b", NOW + WINDOW_MS + 1);
    expect(afterWindow.ok).toBe(true);
  });

  it("buckets são independentes por IP", () => {
    for (let i = 0; i < LIMIT; i++) {
      expect(rateLimit.checkRateLimit("ip-c", NOW).ok).toBe(true);
    }
    expect(rateLimit.checkRateLimit("ip-c", NOW).ok).toBe(false);
    expect(rateLimit.checkRateLimit("ip-d", NOW).ok).toBe(true);
  });

  it("resetRateLimit zera tudo", () => {
    for (let i = 0; i < LIMIT; i++) rateLimit.checkRateLimit("ip-e", NOW);
    expect(rateLimit.checkRateLimit("ip-e", NOW).ok).toBe(false);

    rateLimit.resetRateLimit();
    expect(rateLimit.checkRateLimit("ip-e", NOW).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("prefere X-Forwarded-For (primeiro hop)", () => {
    const key = rateLimit.clientKey(
      request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
    );
    expect(key).toBe("203.0.113.7");
  });

  it("cai para X-Real-IP e depois para 'local'", () => {
    expect(rateLimit.clientKey(request({ "x-real-ip": " 198.51.100.2 " }))).toBe(
      "198.51.100.2",
    );
    expect(rateLimit.clientKey(request())).toBe("local");
  });
});

describe("enforceRateLimit", () => {
  it("devolve null enquanto cabe no limite", () => {
    expect(rateLimit.enforceRateLimit(request(), NOW)).toBeNull();
  });

  it("devolve BffError 429 com retryAfter quando estoura", () => {
    for (let i = 0; i < LIMIT; i++) rateLimit.enforceRateLimit(request(), NOW);

    const error = rateLimit.enforceRateLimit(request(), NOW);
    expect(error).toBeInstanceOf(BffError);
    expect(error?.code).toBe("RATE_LIMITED");
    expect(error?.status).toBe(429);
    expect(error?.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("config env", () => {
  it("lê o limite validado da env", () => {
    expect(config.BFF_RATE_LIMIT_MAX).toBe(LIMIT);
    expect(config.BFF_RATE_LIMIT_WINDOW_MS).toBe(WINDOW_MS);
  });
});
