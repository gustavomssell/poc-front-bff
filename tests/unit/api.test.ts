import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let api: typeof import("@/lib/server/api");
let rateLimit: typeof import("@/lib/server/rate-limit");
let BffError: typeof import("@/lib/server/errors").BffError;

const LIMIT = 3;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("BFF_RATE_LIMIT_MAX", String(LIMIT));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  api = await import("@/lib/server/api");
  rateLimit = await import("@/lib/server/rate-limit");
  BffError = (await import("@/lib/server/errors")).BffError;
  rateLimit.resetRateLimit();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/market?page=1", { headers });
}

function parsedCall(spy: { mock: { calls: unknown[][] } }, index = 0): Record<string, unknown> {
  return JSON.parse(spy.mock.calls[index][0] as string) as Record<string, unknown>;
}

describe("handleApi", () => {
  it("sucesso: contrato data+meta, headers de rate e log info", async () => {
    const log = console.log as unknown as { mock: { calls: unknown[][] } };

    const res = await api.handleApi(request(), async () =>
      Response.json({ data: { ok: true }, meta: {} }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe(String(LIMIT));
    expect(res.headers.get("x-ratelimit-remaining")).toBe(String(LIMIT - 1));

    const line = parsedCall(log);
    expect(line.event).toBe("bff.request");
    expect(line.path).toBe("/api/market");
    expect(line.status).toBe(200);
    expect(line.rateRemaining).toBe(LIMIT - 1);
    expect(typeof line.ms).toBe("number");
  });

  it("erro lançado vira { error } 500 com log error", async () => {
    const errorLog = console.error as unknown as { mock: { calls: unknown[][] } };

    const res = await api.handleApi(request(), async () => {
      throw new Error("boom");
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error).toEqual({ code: "UPSTREAM_ERROR", message: "boom" });

    const line = parsedCall(errorLog);
    expect(line.event).toBe("bff.request_failed");
    expect(line.code).toBe("UPSTREAM_ERROR");
    expect(line.message).toBe("boom");
  });

  it("BffError preserva status e código no contrato", async () => {
    const res = await api.handleApi(request(), async () => {
      throw new BffError("BAD_REQUEST", "page deve ser >= 1.", 400);
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("bloqueia na requisição acima do limite com 429 + retry-after", async () => {
    for (let i = 0; i < LIMIT; i++) {
      const ok = await api.handleApi(request(), async () => Response.json({}));
      expect(ok.status).toBe(200);
    }

    const blocked = await api.handleApi(request(), async () => Response.json({}));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(blocked.headers.get("x-ratelimit-remaining")).toBe("0");

    const body = (await blocked.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toContain("minuto");

    const warn = console.warn as unknown as { mock: { calls: unknown[][] } };
    expect(parsedCall(warn).event).toBe("bff.rate_limited");
  });

  it("rate limit é por IP: outro cliente não é afetado", async () => {
    for (let i = 0; i < LIMIT; i++) {
      await api.handleApi(request({ "x-forwarded-for": "10.0.0.1" }), async () =>
        Response.json({}),
      );
    }

    const blocked = await api.handleApi(request({ "x-forwarded-for": "10.0.0.1" }), async () =>
      Response.json({}),
    );
    expect(blocked.status).toBe(429);

    const other = await api.handleApi(request({ "x-forwarded-for": "10.0.0.2" }), async () =>
      Response.json({}),
    );
    expect(other.status).toBe(200);
  });
});
