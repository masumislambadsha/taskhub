import { describe, expect, it } from "vitest";
import {
  canWithdraw,
  coinsToUsdBuy,
  coinsToUsdWithdraw,
  usdToCoins,
} from "./coins";
import {
  COINS_PER_DOLLAR_BUY,
  COINS_PER_DOLLAR_WITHDRAW,
  MIN_WITHDRAWAL_COINS,
} from "./constants";

describe("coin conversions", () => {
  it("converts coins to USD at the withdrawal rate", () => {
    expect(coinsToUsdWithdraw(0)).toBe(0);
    expect(coinsToUsdWithdraw(COINS_PER_DOLLAR_WITHDRAW)).toBe(1);
    expect(coinsToUsdWithdraw(200)).toBe(10);
    expect(coinsToUsdWithdraw(30)).toBe(1.5);
  });

  it("rounds withdrawal USD to two decimals", () => {
    expect(coinsToUsdWithdraw(1)).toBe(0.05);
    expect(coinsToUsdWithdraw(7)).toBe(0.35);
    expect(coinsToUsdWithdraw(33)).toBe(1.65);
  });

  it("converts coins to USD at the purchase rate", () => {
    expect(coinsToUsdBuy(0)).toBe(0);
    expect(coinsToUsdBuy(COINS_PER_DOLLAR_BUY)).toBe(1);
    expect(coinsToUsdBuy(150)).toBe(15);
    expect(coinsToUsdBuy(1)).toBe(0.1);
  });

  it("converts USD to coins at the purchase rate", () => {
    expect(usdToCoins(0)).toBe(0);
    expect(usdToCoins(1)).toBe(COINS_PER_DOLLAR_BUY);
    expect(usdToCoins(35)).toBe(350);
  });

  it("buying then converting back returns the same dollars", () => {
    expect(coinsToUsdBuy(usdToCoins(12))).toBe(12);
  });
});

describe("canWithdraw", () => {
  it("uses 200 coins as the default minimum", () => {
    expect(MIN_WITHDRAWAL_COINS).toBe(200);
  });

  it("rejects one coin below the boundary", () => {
    expect(canWithdraw(199)).toBe(false);
  });

  it("accepts exactly the boundary and above", () => {
    expect(canWithdraw(200)).toBe(true);
    expect(canWithdraw(201)).toBe(true);
  });

  it("rejects zero", () => {
    expect(canWithdraw(0)).toBe(false);
  });

  it("honours a custom minimum", () => {
    expect(canWithdraw(99, 100)).toBe(false);
    expect(canWithdraw(100, 100)).toBe(true);
  });
});
