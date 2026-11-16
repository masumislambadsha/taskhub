import Withdrawal, { type IWithdrawalDoc } from "@/models/Withdrawal";
import { SYSTEM_ACCOUNTS, userAccount } from "../accounts";
import { InsufficientCoinsError, UnknownAccountError } from "../errors";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";

export type ApproveWithdrawalResult =
  | { ok: true; withdrawal: IWithdrawalDoc }
  | { ok: false; reason: "not_found" | "insufficient_coins" };

/**
 * Approves a pending withdrawal. Coins leave the worker at approval (as before):
 * `worker -N, system:issuance +N` (key `withdrawal:<id>`), retiring them from
 * circulation. The status flip is conditional on `pending` and runs in the same
 * transaction, so if the worker's balance can't cover it, the approval is
 * refused and the withdrawal stays pending.
 */
export async function approveWithdrawal(args: {
  withdrawalId: string;
  adminId: string;
}): Promise<ApproveWithdrawalResult> {
  const { withdrawalId, adminId } = args;
  try {
    return await inLedgerTransaction(async (session): Promise<ApproveWithdrawalResult> => {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: withdrawalId, status: "pending" },
        { $set: { status: "approved", processedAt: new Date() } },
        { session, returnDocument: "after" },
      );
      if (!withdrawal) return { ok: false, reason: "not_found" };

      await postTransaction(
        {
          type: "withdrawal",
          idempotencyKey: `withdrawal:${withdrawalId}`,
          entries: [
            { accountId: userAccount(withdrawal.workerId), amount: -withdrawal.coinRequested },
            { accountId: SYSTEM_ACCOUNTS.ISSUANCE, amount: withdrawal.coinRequested },
          ],
          meta: { withdrawalId, userId: String(withdrawal.workerId) },
          createdBy: adminId,
        },
        session,
      );
      return { ok: true, withdrawal };
    });
  } catch (err) {
    // Thrown inside the transaction, so the status flip was rolled back too.
    if (err instanceof InsufficientCoinsError || err instanceof UnknownAccountError) {
      return { ok: false, reason: "insufficient_coins" };
    }
    throw err;
  }
}

/** Rejects a pending withdrawal (conditional on `pending`). No coins move. */
export async function rejectWithdrawal(args: {
  withdrawalId: string;
}): Promise<
  { ok: true; withdrawal: IWithdrawalDoc } | { ok: false; reason: "not_found" }
> {
  const withdrawal = await Withdrawal.findOneAndUpdate(
    { _id: args.withdrawalId, status: "pending" },
    { $set: { status: "rejected", processedAt: new Date() } },
    { returnDocument: "after" },
  );
  return withdrawal ? { ok: true, withdrawal } : { ok: false, reason: "not_found" };
}
