import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cached, cacheSize, clearCache } from "@/lib/server/cache";

const opts = { freshMs: 1_000, staleMs: 5_000 };

describe("cached", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("MISS na primeira chamada, HIT dentro do fresh sem chamar o upstream", async () => {
    const fetcher = vi.fn().mockResolvedValue({ v: 1 });

    const first = await cached("a", fetcher, opts);
    expect(first.status).toBe("MISS");
    expect(first.data).toEqual({ v: 1 });
    expect(first.ageSeconds).toBe(0);
    expect(first.fetchMs).toBeGreaterThanOrEqual(0);

    const second = await cached("a", fetcher, opts);
    expect(second.status).toBe("HIT");
    expect(second.data).toEqual({ v: 1 });
    expect(second.fetchMs).toBe(0);
    expect(second.ageSeconds).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("expõe a idade do cache em segundos no HIT", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    const window = { freshMs: 10_000, staleMs: 5_000 };
    await cached("age", fetcher, window);

    vi.advanceTimersByTime(3_400);
    const hit = await cached("age", fetcher, window);

    expect(hit.status).toBe("HIT");
    expect(hit.ageSeconds).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("STALE: serve o dado antigo e revalida em background", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 });

    await cached("stale", fetcher, opts);
    vi.advanceTimersByTime(2_000); // passou do fresh, ainda dentro do stale

    const stale = await cached("stale", fetcher, opts);
    expect(stale.status).toBe("STALE");
    expect(stale.data).toEqual({ v: 1 });
    expect(stale.ageSeconds).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(0);
    const refreshed = await cached("stale", fetcher, opts);
    expect(refreshed.status).toBe("HIT");
    expect(refreshed.data).toEqual({ v: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("MISS com dado novo quando fresh + stale expira", async () => {
    await cached("expired", vi.fn().mockResolvedValue({ v: 1 }), opts);
    vi.advanceTimersByTime(opts.freshMs + opts.staleMs + 1);

    const fetcher = vi.fn().mockResolvedValue({ v: 2 });
    const res = await cached("expired", fetcher, opts);

    expect(res.status).toBe("MISS");
    expect(res.data).toEqual({ v: 2 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("single-flight: chamadas concorrentes compartilham um único fetch", async () => {
    let resolve!: (v: string) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    );

    const p1 = cached("flight", fetcher, opts);
    const p2 = cached("flight", fetcher, opts);
    resolve("valor");

    const [a, b] = await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a.status).toBe("MISS");
    expect(b.status).toBe("MISS");
    expect(a.data).toBe("valor");
    expect(b.data).toBe("valor");
  });

  it("falha na revalidação em background mantém o dado STALE servido", async () => {
    await cached("bg-fail", vi.fn().mockResolvedValue({ v: 1 }), opts);
    vi.advanceTimersByTime(2_000);

    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    const res = await cached("bg-fail", failing, opts);

    expect(res.status).toBe("STALE");
    expect(res.data).toEqual({ v: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("fetch falho com entry vencido serve o dado antigo como STALE", async () => {
    await cached("fallback", vi.fn().mockResolvedValue({ v: 1 }), opts);
    vi.advanceTimersByTime(opts.freshMs + opts.staleMs + 1_000);

    const res = await cached("fallback", vi.fn().mockRejectedValue(new Error("boom")), opts);
    expect(res.status).toBe("STALE");
    expect(res.data).toEqual({ v: 1 });
    expect(res.ageSeconds).toBeGreaterThan(0);
  });

  it("propaga o erro quando não há nenhum dado salvo", async () => {
    await expect(
      cached("no-entry", vi.fn().mockRejectedValue(new Error("boom")), opts),
    ).rejects.toThrow("boom");
    expect(cacheSize()).toBe(0);
  });

  it("clearCache zera o store", async () => {
    await cached("wipe", vi.fn().mockResolvedValue(1), opts);
    expect(cacheSize()).toBe(1);
    clearCache();
    expect(cacheSize()).toBe(0);
  });
});
