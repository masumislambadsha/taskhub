/**
 * A small in-memory fixed-window rate limiter, keyed by any string (a user ID,
 * for example). Counts live in this process only, so with several web
 * instances each one counts on its own; roadmap item 2.3 moves it to Redis.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { ok: boolean; retryAfterSeconds: number } {
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  entry.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Clears all counters. For tests. */
export function resetRateLimits(): void {
  windows.clear();
}
