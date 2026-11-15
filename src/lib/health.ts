import Redis from "ioredis";

export const CHECK_TIMEOUT_MS = 1000;

export function getVersion(): string {
  return process.env.GIT_SHA || "dev";
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
