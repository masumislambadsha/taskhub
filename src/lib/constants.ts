import type { CoinPackage } from "@/types";

export const COIN_PACKAGES: CoinPackage[] = [
  { id: "pkg_10", coins: 10, price: 1, label: "Starter" },
  { id: "pkg_150", coins: 150, price: 10, label: "Basic", popular: false },
  { id: "pkg_500", coins: 500, price: 20, label: "Pro", popular: true },
  { id: "pkg_1000", coins: 1000, price: 35, label: "Elite" },
];

export const WORKER_INITIAL_COINS = 10;
export const BUYER_INITIAL_COINS = 50;


export const COINS_PER_DOLLAR_BUY = 10;

export const COINS_PER_DOLLAR_WITHDRAW = 20;
export const MIN_WITHDRAWAL_COINS = 200;
/** Most a worker may withdraw in 24 hours and in 7 days (fixed until trust levels, roadmap 3.4, set them per worker). */
export const WITHDRAWAL_DAILY_LIMIT_COINS = 2000;
export const WITHDRAWAL_WEEKLY_LIMIT_COINS = 5000;
/** How long the emailed confirmation link works, and how long an unconfirmed request waits before it is cancelled. */
export const WITHDRAWAL_CONFIRM_LINK_MS = 30 * 60 * 1000;
export const WITHDRAWAL_UNCONFIRMED_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const TASK_CATEGORIES = [
  "Social Media",
  "Video & Audio",
  "Writing & Reviews",
  "App Testing",
  "Research",
  "Data Entry",
  "Other",
];

export const PAYMENT_GATEWAYS = ["stripe", "bkash", "sslcommerz"] as const;
