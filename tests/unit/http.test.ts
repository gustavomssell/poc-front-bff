import { describe, expect, it } from "vitest";
import { BffError, isBffError, toBffError } from "@/lib/server/errors";
import { errorResponse, jsonResponse, metaFromResult } from "@/lib/server/http";

function okMeta() {
  return metaFromResult("brapi", { status: "HIT", fetchMs: 0, ageSeconds: 12 });
}

describe("metaFromResult", () => {
  it("monta o meta do contrato HTTP", () => {
    const meta = okMeta();

    expect(meta.cache).toBe("HIT");
    expect(meta.ageSeconds).toBe(12);
    expect(meta.sources).toEqual([{ source: "brapi", status: "HIT", fetchMs: 0 }]);
    expect(() => new Date(meta.generatedAt).toISOString()).not.toThrow();
  });
});

describe("jsonResponse", () => {
  it("envolve data + meta e expõe os headers de contrato", async () => {
    const meta = okMeta();
    const res = jsonResponse({ hello: "world" }, meta);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-bff-cache")).toBe("HIT");
    expect(res.headers.get("x-bff-generated-at")).toBe(meta.generatedAt);
    expect(res.headers.get("x-bff-upstream-ms")).toBe("0");
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = (await res.json()) as { data: { hello: string }; meta: typeof meta };
    expect(body.data).toEqual({ hello: "world" });
    expect(body.meta.cache).toBe("HIT");
  });

  it("soma o fetchMs das fontes quando meta.fetchMs não veio preenchido", async () => {
    const meta = {
      generatedAt: "2026-10-03T12:00:00.000Z",
      cache: "PARTIAL" as const,
      sources: [
        { source: "brapi" as const, fetchMs: 10 },
        { source: "bcb" as const, fetchMs: 25 },
      ],
    };
    const res = jsonResponse({}, meta);

    expect(res.headers.get("x-bff-upstream-ms")).toBe("35");
    expect(res.headers.get("x-bff-cache")).toBe("PARTIAL");
  });
});

describe("errorResponse", () => {
  it("mantém code/status/mensagem do BffError", async () => {
    const res = errorResponse(
      new BffError("BAD_REQUEST", "page deve ser >= 1.", 400),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("retry-after")).toBeNull();

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error).toEqual({ code: "BAD_REQUEST", message: "page deve ser >= 1." });
  });

  it("propaga retry-after para erros de rate limit", async () => {
    const res = errorResponse(new BffError("RATE_LIMITED", "Muitas requisições.", 429, 30));

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");

    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("converte erros genéricos em UPSTREAM_ERROR 500", async () => {
    const res = errorResponse(new Error("estouro inesperado"));

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UPSTREAM_ERROR");
    expect(body.error.message).toBe("estouro inesperado");
  });

  it("não vaza mensagem interna de erros não-Error", async () => {
    const res = errorResponse("string qualquer");

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UPSTREAM_ERROR");
    expect(body.error.message).toBe("Erro interno do BFF");
  });
});

describe("errors", () => {
  it("isBffError reconhece apenas BffError", () => {
    expect(isBffError(new BffError("NOT_FOUND", "x"))).toBe(true);
    expect(isBffError(new Error("x"))).toBe(false);
  });

  it("toBffError preserva BffError e embrulha o resto", () => {
    const original = new BffError("UPSTREAM_ERROR", "orig", 502);
    expect(toBffError(original)).toBe(original);
    expect(toBffError(new Error("boom")).message).toBe("boom");
    expect(toBffError("boom").status).toBe(500);
  });
});
