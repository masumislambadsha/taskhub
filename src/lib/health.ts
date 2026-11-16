import Redis from "ioredis";

export const CHECK_TIMEOUT_MS = 1000;
/** Budget for establishing the first MongoDB connection (serverless cold start). */
export const MONGO_CONNECT_TIMEOUT_MS = 5000;
/** Budget for the MongoDB ping once connected. */
export const MONGO_PING_TIMEOUT_MS = CHECK_TIMEOUT_MS;

/**
 * Build identifier: GIT_SHA, else the platform's commit SHA (Vercel, then
 * Render), else "dev". Shortened to 7 characters.
 */
export function getVersion(): string {
  const sha =
    process.env.GIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT;
  return sha ? sha.slice(0, 7) : "dev";
}

export function getUptimeSeconds(): number {
  return Math.round(process.uptime());
}

export type CheckResult =
  | { ok: boolean; ms: number }
  | { skipped: true };

export function withTimeout<T>(
  promise: Promise<T>,
  ms = CHECK_TIMEOUT_MS,
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs a check and reports only ok/ms. Error details are never returned,
 * because health responses are public.
 */
export async function timedCheck(
  fn: () => Promise<unknown>,
): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    await withTimeout(fn());
    return { ok: true, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

/**
 * Checks MongoDB in two steps: up to MONGO_CONNECT_TIMEOUT_MS to connect, then
 * up to MONGO_PING_TIMEOUT_MS for the ping. `ms` covers both. A connect that
 * times out is not cancelled: `connect` is expected to cache its in-flight
 * promise (connectDB does), so the next call reuses it instead of starting a
 * second connection attempt.
 */
export async function checkMongo(
  connect: () => Promise<unknown>,
  ping: () => Promise<unknown>,
  {
    connectTimeoutMs = MONGO_CONNECT_TIMEOUT_MS,
    pingTimeoutMs = MONGO_PING_TIMEOUT_MS,
  }: { connectTimeoutMs?: number; pingTimeoutMs?: number } = {},
): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    await withTimeout(connect(), connectTimeoutMs);
    await withTimeout(ping(), pingTimeoutMs);
    return { ok: true, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

/** Pings Redis with a short-lived connection. Skipped when REDIS_URL is unset. */
export async function checkRedis(): Promise<CheckResult> {
  const url = process.env.REDIS_URL;
  if (!url) return { skipped: true };

  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: CHECK_TIMEOUT_MS,
    commandTimeout: CHECK_TIMEOUT_MS,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  client.on("error", () => {});

  try {
    return await timedCheck(async () => {
      await client.connect();
      await client.ping();
    });
  } finally {
    client.disconnect();
  }
}
