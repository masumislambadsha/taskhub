import { DAILY_EARNING_CAP, type TrustLevel } from "./trust";

/** Dhaka is UTC+6 all year (no daylight saving). */
const DHAKA_OFFSET_MS = 6 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** The start of the current day in Dhaka (midnight there), as an instant. */
export function dhakaDayStart(now = new Date()): Date {
  const local = now.getTime() + DHAKA_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - DHAKA_OFFSET_MS);
}

/** When today's limit resets: the next midnight in Dhaka. */
export function dhakaNextMidnight(now = new Date()): Date {
  return new Date(dhakaDayStart(now).getTime() + DAY_MS);
}

/**
 * The most a worker of this level may have earned or have waiting for review in
 * one Dhaka day, in coins. Defaults come from `DAILY_EARNING_CAP`; set
 * `EARNING_CAPS=100,300,800,2000` (levels 0 to 3) to change them without a deploy of code.
 */
export function dailyCapFor(level: TrustLevel | number): number {
  const fromEnv = (process.env.EARNING_CAPS ?? "").split(",").map((n) => Number(n.trim()));
  if (fromEnv.length === 4 && fromEnv.every((n) => Number.isFinite(n) && n > 0)) return fromEnv[Math.min(3, Math.max(0, level))];
  return DAILY_EARNING_CAP[Math.min(3, Math.max(0, level)) as TrustLevel];
}

export const DAILY_CAP_MESSAGE = "Daily limit reached. It resets at midnight, Dhaka time.";
