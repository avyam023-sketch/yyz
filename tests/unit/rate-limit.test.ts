import { describe, expect, it } from "vitest";
import { clientKey, memoryRateLimit, rateLimit, redisRateLimit } from "@/lib/rate-limit";
import { buildSampleBrochurePdf } from "@/lib/sample/catalogue";

describe("memoryRateLimit", () => {
  it("allows up to the limit within a window, then blocks until it resets", () => {
    const key = `test:${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(memoryRateLimit(key, 3, 60_000, t0).ok).toBe(true);
    const blocked = memoryRateLimit(key, 3, 60_000, t0 + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(59);
    expect(memoryRateLimit(key, 3, 60_000, t0 + 60_001).ok).toBe(true);
  });

  it("prefers the platform IP header, then the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientKey(new Headers())).toBe("unknown");
    expect(
      clientKey(new Headers({ "x-vercel-forwarded-for": "198.51.100.7", "x-real-ip": "203.0.113.9", "x-forwarded-for": "203.0.113.9" })),
    ).toBe("198.51.100.7");
  });
});

describe("redisRateLimit", () => {
  function fakeRedis(count: number, pttl: number) {
    const calls: { url: string; body: unknown; auth: string | null }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
      return new Response(JSON.stringify([{ result: count }, { result: 1 }, { result: pttl }]), { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
  }

  it("increments a hashed key, sets the window expiry once and allows within the limit", async () => {
    const { calls, fetchImpl } = fakeRedis(2, 59_000);
    const r = await redisRateLimit({ url: "https://redis.example/", token: "t0k", fetch: fetchImpl }, "events:1.2.3.4", 3, 60_000);
    expect(r).toEqual({ ok: true, retryAfter: 0 });
    expect(calls[0].url).toBe("https://redis.example/pipeline");
    expect(calls[0].auth).toBe("Bearer t0k");
    const body = calls[0].body as string[][];
    const redisKey = body[0][1];
    expect(redisKey).toMatch(/^rl:[0-9a-f]{32}$/);
    expect(JSON.stringify(body)).not.toContain("1.2.3.4");
    expect(body).toEqual([["INCR", redisKey], ["PEXPIRE", redisKey, "60000", "NX"], ["PTTL", redisKey]]);
  });

  it("blocks over the limit and reports the remaining window", async () => {
    const { fetchImpl } = fakeRedis(4, 12_300);
    expect(await redisRateLimit({ url: "https://redis.example", token: "t", fetch: fetchImpl }, "k", 3, 60_000)).toEqual({ ok: false, retryAfter: 13 });
  });

  it("throws on store errors so the caller can fall back", async () => {
    const failing = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(redisRateLimit({ url: "https://redis.example", token: "t", fetch: failing }, "k", 3, 60_000)).rejects.toThrow(/500/);
    const errored = (async () => new Response(JSON.stringify([{ error: "WRONGPASS" }]), { status: 200 })) as unknown as typeof fetch;
    await expect(redisRateLimit({ url: "https://redis.example", token: "t", fetch: errored }, "k", 3, 60_000)).rejects.toThrow();
  });
});

describe("rateLimit", () => {
  it("falls back to memory when no shared store is configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const key = `fallback:${Math.random()}`;
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
  });

  it("falls back to memory when the shared store is unreachable", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:9";
    process.env.UPSTASH_REDIS_REST_TOKEN = "t";
    try {
      const key = `down:${Math.random()}`;
      expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
      expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
    } finally {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    }
  });
});

describe("sample brochure", () => {
  it("is a structurally valid PDF with a correct cross-reference table", () => {
    const pdf = new TextDecoder().decode(buildSampleBrochurePdf("Example Residences"));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 5");
    const startxref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((offset, i) => expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });
});
