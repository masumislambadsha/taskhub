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
