import { createHash } from "node:crypto";
import Redis from "ioredis";
import { NextResponse } from "next/server";
import { API_PLAN_LIMITS, LIMITS, type LimitName } from "@/lib/rate-limit-config";
import { forgetMemoryKey, rateLimit as memoryLimit, resetRateLimits as resetMemory } from "@/lib/rate-limit-memory";
import { logger } from "@/lib/logger";

export interface LimitResult {
  ok: boolean;
  retryAfterSeconds: number;
  remaining: number;
  /** True when the answer came from the fail-open or fail-closed rule because Redis was unreachable. */
  degraded?: boolean;
}

/**
 * Counts one attempt (or `cost` attempts) and says whether it is allowed.
 * Atomic in Redis (one script: add, and start the window on the first hit), so
 * two instances can never both think they are under the limit.
 */
const SCRIPT = `
local c = redis.call('INCRBY', KEYS[1], ARGV[1])
if c == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[2]); ttl = tonumber(ARGV[2]) end
return {c, ttl}
`;

let client: Redis | null = null;
let clientUrl: string | undefined;

function redis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client || clientUrl !== url) {
    client?.disconnect();
    // Fail fast: a request must never hang on the limiter. The offline queue stays
    // on so the first command after start waits for the connection (a refused
    // first request would fail closed); `commandTimeout` bounds that wait.
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      commandTimeout: 1000,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    client.on("error", () => {});
    clientUrl = url;
  }
  return client;
}

/** Closes the Redis connection. For tests and shutdown. */
export async function closeRateLimiter(): Promise<void> {
  const c = client;
  client = null;
  clientUrl = undefined;
  c?.disconnect();
}

/** Forgets every in-memory counter. For tests. */
export function resetMemoryLimits(): void {
  resetMemory();
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

type Spec = { points: number; windowSec: number; failMode?: "open" | "closed" };

async function consumeSpec(
  prefix: string,
  spec: Spec,
  key: string,
  cost = 1,
): Promise<LimitResult> {
  const failMode = spec.failMode ?? "closed";
  const r = redis();
  if (!r) {
    // Redis is not configured (local development, or a deployment without it):
    // count in this process. Each instance counts alone, which is the old behaviour.
    const res = memoryLimit(`${prefix}:${key}`, spec.points, spec.windowSec * 1000);
    return { ok: res.ok, retryAfterSeconds: res.retryAfterSeconds, remaining: res.ok ? 1 : 0 };
  }
  try {
    const [count, ttl] = (await r.eval(SCRIPT, 1, `rl:${prefix}:${key}`, cost, spec.windowSec)) as [number, number];
    return {
      ok: count <= spec.points,
      retryAfterSeconds: count <= spec.points ? 0 : Math.max(1, ttl),
      remaining: Math.max(0, spec.points - count),
    };
  } catch (err) {
    // Redis is configured but did not answer.
    logger.warn({ limit: prefix, failMode, err: err instanceof Error ? err.message : String(err) }, "rate limiter unavailable");
    return failMode === "open"
      ? { ok: true, retryAfterSeconds: 0, remaining: 0, degraded: true }
      : { ok: false, retryAfterSeconds: 5, remaining: 0, degraded: true };
  }
}

/** Counts one attempt against a named limit from the config. Blocks are logged. */
export async function consume(name: LimitName, key: string, cost = 1): Promise<LimitResult> {
  const res = await consumeSpec(name, LIMITS[name], key, cost);
  if (!res.ok && !res.degraded) {
    // The key can hold an email address, so only a hash is logged.
    logger.warn({ limit: name, key: hash(key), retryAfterSeconds: res.retryAfterSeconds }, "rate limit hit");
  }
  return res;
}

/** The AI limit is per user and feature (`ai:<feature>:<userId>`). */
export function consumeAi(feature: string, userId: string): Promise<LimitResult> {
  return consume("ai", `${feature}:${userId}`);
}

/** The public API limit is per key, set by plan. */
export async function consumeApiKey(keyId: string, plan: keyof typeof API_PLAN_LIMITS): Promise<LimitResult> {
  const res = await consumeSpec("api", { ...API_PLAN_LIMITS[plan], failMode: "closed" }, keyId);
  if (!res.ok && !res.degraded) logger.warn({ limit: "api", key: hash(keyId), plan }, "rate limit hit");
  return res;
}

/** Clears one key, for example an account's failed-login count after a successful login. */
export async function resetLimit(name: LimitName, key: string): Promise<void> {
  const r = redis();
  if (!r) {
    forgetMemoryKey(`${name}:${key}`);
    return;
  }
  try {
    await r.del(`rl:${name}:${key}`);
  } catch {
    // The window will run out by itself.
  }
}

/**
 * The client's IP. Behind our own Nginx only `X-Real-IP` is trusted: Nginx sets
 * it from the connection and overwrites anything the client sent. A client can
 * send any `X-Forwarded-For` it likes, so that header is used only on Vercel,
 * whose edge writes it. With neither, requests share one bucket named
 * "unknown", which is safe (strict) rather than open.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  if (process.env.VERCEL) {
    const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/** The 429 answer, with `Retry-After` and text the UI can show as is. */
export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const wait = retryAfterSeconds < 60 ? `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return NextResponse.json(
    { error: `Too many requests. Try again in ${wait}.`, retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
