import User from "@/models/User";
import { SYSTEM_ACCOUNTS, userAccount } from "./accounts";
import { InvalidTransactionError, LedgerError, UnknownAccountError } from "./errors";
import { recordTransaction, validateInput, type Session } from "./journal";

/**
 * Lazy opening of a user account.
 *
 * Users that existed before the ledger hold coins in `User.coins` with no
 * journal history. Before the first posting that touches such a user, inside
 * the same transaction, this posts a journal-only opening entry
 * (`system:migration -coins`, `user:<id> +coins`) that changes
 * `system:migration` but NOT `User.coins` (it already holds them), then sets
 * `ledgerOpenedAt`. The write to the user document makes concurrent postings
 * for the same user conflict and retry, so the opening happens exactly once.
 *
 * Returns true if it opened the account, false if it was already open.
 */
export async function ensureUserOpen(
  userId: string,
  session: Session,
): Promise<boolean> {
  const user = await User.findById(userId)
    .select("coins ledgerOpenedAt")
    .session(session)
    .lean();
  if (!user) throw new UnknownAccountError(userAccount(userId));
  if (user.ledgerOpenedAt) return false;

  const coins = user.coins ?? 0;
  if (!Number.isSafeInteger(coins)) {
    throw new InvalidTransactionError(
      `User ${userId} holds a non-integer balance (${coins}); fix it before opening the account`,
    );
  }

  if (coins !== 0) {
    const input = {
      type: "opening" as const,
      idempotencyKey: `opening:user:${userId}`,
      entries: [
        { accountId: SYSTEM_ACCOUNTS.MIGRATION, amount: -coins },
        { accountId: userAccount(userId), amount: coins },
      ],
      meta: { userId },
      createdBy: "system",
    };
    validateInput(input);
    await recordTransaction(input, session, { updateUserBalances: false });
  }

  const res = await User.updateOne(
    { _id: userId, ledgerOpenedAt: { $exists: false } },
    { $set: { ledgerOpenedAt: new Date() } },
    { session },
  );
  if (res.matchedCount === 0) {
    // Cannot happen inside a snapshot transaction (a concurrent opening shows
    // up as a write conflict, which is retried); fail closed if it does.
    throw new LedgerError(`User ${userId} was opened concurrently`);
  }
  return true;
}
