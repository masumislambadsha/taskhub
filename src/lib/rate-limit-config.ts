/**
 * Every rate limit in one place. Each limit counts attempts per key in a fixed
 * window, shared by every instance through Redis.
 *
 * `failMode` is what happens when Redis is configured but cannot be reached:
 * - `closed`: refuse. For things that must never run unchecked (signing in,
 *   signing up, two-factor codes, withdrawals, AI spend).
 * - `open`: allow. For things where blocking is worse than the risk (chat,
 *   submitting work, uploads). The block is logged either way.
 *
 * Many mobile users in Bangladesh share one IP through their carrier, so IP
 * limits are generous and account limits are strict.
 */
export const LIMITS = {
  /** 5 failed or repeated attempts per account in 15 minutes. */
  login_account: { points: 5, windowSec: 15 * 60, failMode: "closed" },
  /** 30 per IP in 15 minutes. */
  login_ip: { points: 30, windowSec: 15 * 60, failMode: "closed" },
  /** 5 sign-ups per hour per IP and device. */
  signup: { points: 5, windowSec: 60 * 60, failMode: "closed" },
  /** 5 two-factor codes per 15 minutes per user (the database lockout is a second line). */
  mfa: { points: 5, windowSec: 15 * 60, failMode: "closed" },
  /** 30 submissions per hour per worker. */
  submit: { points: 30, windowSec: 60 * 60, failMode: "open" },
  /** 3 withdrawal requests per day per worker. */
  withdraw: { points: 3, windowSec: 24 * 60 * 60, failMode: "closed" },
  /** 3 confirmation emails per minute per worker. */
  withdraw_resend: { points: 3, windowSec: 60, failMode: "open" },
  /** 20 chat messages per 10 seconds per user. */
  chat: { points: 20, windowSec: 10, failMode: "open" },
  /** 10 image uploads per minute per user. */
  upload: { points: 10, windowSec: 60, failMode: "open" },
  /** 20 AI requests per day per user and feature. */
  ai: { points: 20, windowSec: 24 * 60 * 60, failMode: "closed" },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Public API limits per plan (roadmap 5.5): requests per minute for one API key. */
export const API_PLAN_LIMITS = {
  free: { points: 60, windowSec: 60 },
  pro: { points: 600, windowSec: 60 },
} as const;
