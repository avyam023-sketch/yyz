/**
 * Fixed-window rate limiting for the public endpoints.
 *
 * With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, counters live
 * in Upstash Redis and are shared by every server instance. Without them, or
 * if Redis cannot be reached within a second, counters fall back to this
 * instance's memory. Either way the database functions enforce their own
 * per-microsite limits, so a fallback never removes protection entirely.
 */

import { createHash } from "node:crypto";

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const windows = new Map<string, { count: number; resetAt: number }>();
let lastSweep = Date.now();

export function memoryRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    lastSweep = now;
  }
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  w.count += 1;
  if (w.count > limit) return { ok: false, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Upstash Redis store (REST API, no client library)
// ---------------------------------------------------------------------------

export interface RedisConfig {
  url: string;
  token: string;
  fetch?: typeof fetch;
}

export async function redisRateLimit(config: RedisConfig, key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const doFetch = config.fetch ?? fetch;
  // Keys contain IP addresses and microsite tokens: only a hash leaves this server.
  const redisKey = `rl:${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
  const res = await doFetch(`${config.url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    // INCR the window counter, start its expiry on first use, read the time left.
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(windowMs), "NX"],
      ["PTTL", redisKey],
    ]),
    signal: AbortSignal.timeout(1000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Rate-limit store responded ${res.status}`);
  const [incr, , pttl] = (await res.json()) as { result?: number; error?: string }[];
  if (incr?.error || typeof incr?.result !== "number") throw new Error("Rate-limit store returned an error");
  const ttl = typeof pttl?.result === "number" && pttl.result > 0 ? pttl.result : windowMs;
  return incr.result > limit ? { ok: false, retryAfter: Math.ceil(ttl / 1000) } : { ok: true, retryAfter: 0 };
}

function redisConfigFromEnv(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

let warned = false;

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = redisConfigFromEnv();
  if (redis) {
    try {
      return await redisRateLimit(redis, key, limit, windowMs);
    } catch (error) {
      if (!warned) {
        console.warn("[rate-limit] shared store unavailable; using in-memory limits", { message: (error as Error).message });
        warned = true;
      }
    }
  }
  return memoryRateLimit(key, limit, windowMs);
}

/**
 * Best-effort client IP from proxy headers. Used only as a rate-limit key, never stored.
 * `x-vercel-forwarded-for` is set by Vercel's edge and cannot be supplied by the client.
 * Other hosts must overwrite `x-real-ip` / `x-forwarded-for` at their proxy.
 */
export function clientKey(headers: Headers): string {
  return (
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
