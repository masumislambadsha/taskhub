import mongoose from "mongoose";

/**
 * Account IDs and system account names. Every other module builds and parses
 * account IDs through this file only.
 *
 *   user:<userId>        cached balance is User.coins
 *   escrow:task:<taskId> coins held for a task; never negative
 *   system:*             may go negative
 */
export const SYSTEM_ACCOUNTS = {
  /** Source of every sold coin; its negative balance is the coins in circulation. */
  ISSUANCE: "system:issuance",
  /** Signup bonuses. */
  PROMOTIONS: "system:promotions",
  /** Admin corrections. */
  ADJUSTMENTS: "system:adjustments",
  /** Coins of removed users. */
  FORFEITED: "system:forfeited",
  /** Opening balances for coins that existed before the ledger. */
  MIGRATION: "system:migration",
  /** Coins a worker asked to withdraw, held until the payout is paid or returned. */
  PAYOUTS_PENDING: "system:payouts_pending",
} as const;

export type SystemAccountId =
  (typeof SYSTEM_ACCOUNTS)[keyof typeof SYSTEM_ACCOUNTS];

const SYSTEM_ACCOUNT_IDS: ReadonlySet<string> = new Set(
  Object.values(SYSTEM_ACCOUNTS),
);

export const userAccount = (userId: string | mongoose.Types.ObjectId) =>
  `user:${String(userId)}`;
export const escrowAccount = (taskId: string | mongoose.Types.ObjectId) =>
  `escrow:task:${String(taskId)}`;

export type ParsedAccount =
  | { kind: "user"; userId: string }
  | { kind: "escrow"; taskId: string }
  | { kind: "system"; name: SystemAccountId };

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Parses an account ID, or returns null when it is not a well-formed one. */
export function parseAccount(accountId: string): ParsedAccount | null {
  if (typeof accountId !== "string") return null;
  if (SYSTEM_ACCOUNT_IDS.has(accountId)) {
    return { kind: "system", name: accountId as SystemAccountId };
  }
  if (accountId.startsWith("user:")) {
    const userId = accountId.slice("user:".length);
    return OBJECT_ID.test(userId) ? { kind: "user", userId } : null;
  }
  if (accountId.startsWith("escrow:task:")) {
    const taskId = accountId.slice("escrow:task:".length);
    return OBJECT_ID.test(taskId) ? { kind: "escrow", taskId } : null;
  }
  return null;
}

export const isUserAccount = (accountId: string) =>
  parseAccount(accountId)?.kind === "user";
