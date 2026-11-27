import mongoose from "mongoose";
import User from "@/models/User";
import { SYSTEM_ACCOUNTS, userAccount } from "../accounts";
import { InsufficientCoinsError, UnknownAccountError } from "../errors";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";
import { recordAudit, type AuditContext } from "@/lib/audit";

export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/**
 * Creates a user and grants the signup bonus in one transaction:
 * `system:promotions -N, user +N` (key `signup:<userId>`). The new user is
 * opened in the ledger from the start (`ledgerOpenedAt`) with 0 coins before
 * the bonus is posted. A duplicate email throws a duplicate-key error (see
 * `isDuplicateKeyError`) and leaves nothing behind.
 */
export async function createUserWithBonus(args: {
  data: {
    name: string;
    email: string;
    emailNormalized?: string;
    workerStatus?: "unverified";
    passwordHash?: string;
    photoUrl?: string;
    role: "worker" | "buyer" | "admin" | "demo_admin";
  };
  bonus: number;
}): Promise<{ userId: string; coins: number }> {
  const { data, bonus } = args;
  return inLedgerTransaction(async (session) => {
    const [user] = await User.create(
      [{ ...data, status: "active", coins: 0, ledgerOpenedAt: new Date() }],
      { session },
    );
    if (bonus > 0) {
      await postTransaction(
        {
          type: "signup_bonus",
          idempotencyKey: `signup:${user._id}`,
          entries: [
            { accountId: SYSTEM_ACCOUNTS.PROMOTIONS, amount: -bonus },
            { accountId: userAccount(user._id), amount: bonus },
          ],
          meta: { userId: String(user._id) },
          createdBy: "system",
        },
        session,
      );
    }
    return { userId: String(user._id), coins: Math.max(0, bonus) };
  });
}

export type AdjustCoinsResult =
  | { ok: true; replayed: boolean }
  | { ok: false; reason: "user_not_found" | "insufficient_coins" };

/**
 * An admin correcting a user's balance: `system:adjustments <-> user`
 * (type `admin_adjustment`, createdBy = the admin). A positive `delta` gives
 * the user coins, a negative one takes them (refused if the balance can't
 * cover it). `requestId` makes the call idempotent: repeating it changes
 * nothing.
 */
export async function adjustUserCoins(args: {
  userId: string;
  delta: number;
  adminId: string;
  requestId: string;
  reason?: string;
  /** When given, the adjustment is logged in the same transaction. */
  audit?: AuditContext;
}): Promise<AdjustCoinsResult> {
  const { userId, delta, adminId, requestId, reason, audit } = args;
  try {
    return await inLedgerTransaction(async (session): Promise<AdjustCoinsResult> => {
      const { replayed } = await postTransaction(
        {
          type: "admin_adjustment",
          idempotencyKey: `admin-adjust:${requestId}`,
          entries: [
            { accountId: SYSTEM_ACCOUNTS.ADJUSTMENTS, amount: -delta },
            { accountId: userAccount(userId), amount: delta },
          ],
          meta: { userId, note: reason },
          createdBy: adminId,
        },
        session,
      );
      // A replayed request already has its entry from the first time.
      if (audit && !replayed) {
        await recordAudit(
          audit,
          {
            action: "coins.adjust",
            targetType: "user",
            targetId: userId,
            after: { delta },
            reason,
          },
          session,
        );
      }
      return { ok: true, replayed };
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) return { ok: false, reason: "insufficient_coins" };
    if (err instanceof UnknownAccountError) return { ok: false, reason: "user_not_found" };
    throw err;
  }
}

/**
 * Removes a user. Any coins they hold are first moved to `system:forfeited`
 * (type `forfeit`, key `forfeit:<userId>`) in the same transaction, so the
 * ledger stays balanced. Escrow held for the user's tasks is not touched.
 */
export async function removeUser(args: {
  userId: string;
  adminId: string;
  /** When given, the removal is logged in the same transaction. */
  audit?: AuditContext;
}): Promise<{ ok: true; forfeited: number } | { ok: false; reason: "not_found" }> {
  const { userId, adminId, audit } = args;
  if (!mongoose.isValidObjectId(userId)) return { ok: false, reason: "not_found" };
  return inLedgerTransaction(async (session) => {
    const user = await User.findById(userId).select("coins email role").session(session).lean();
    if (!user) return { ok: false as const, reason: "not_found" as const };

    const coins = user.coins ?? 0;
    if (coins !== 0) {
      // Brings the balance to exactly 0 (a positive balance is moved out).
      await postTransaction(
        {
          type: "forfeit",
          idempotencyKey: `forfeit:${userId}`,
          entries: [
            { accountId: userAccount(userId), amount: -coins },
            { accountId: SYSTEM_ACCOUNTS.FORFEITED, amount: coins },
          ],
          meta: { userId },
          createdBy: adminId,
        },
        session,
      );
    }
    await User.deleteOne({ _id: userId }, { session });
    if (audit) {
      await recordAudit(
        audit,
        {
          action: "user.delete",
          targetType: "user",
          targetId: userId,
          before: { email: user.email, role: user.role, coins },
          after: { forfeited: coins },
        },
        session,
      );
    }
    return { ok: true as const, forfeited: coins };
  });
}
