import { COINS_PER_DOLLAR_WITHDRAW, COINS_PER_DOLLAR_BUY } from "./constants";

export function coinsToUsdWithdraw(coins: number): number {
  return parseFloat((coins / COINS_PER_DOLLAR_WITHDRAW).toFixed(2));
}

export function usdToCoins(usd: number): number {
  return usd * COINS_PER_DOLLAR_BUY;
}

export function coinsToUsdBuy(coins: number): number {
  return parseFloat((coins / COINS_PER_DOLLAR_BUY).toFixed(2));
}

export function canWithdraw(coins: number, minCoins = 200): boolean {
  return coins >= minCoins;
}
