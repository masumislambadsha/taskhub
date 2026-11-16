import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import { SYSTEM_ACCOUNTS, escrowAccount } from "./accounts";
import { InvalidTransactionError, UnknownAccountError } from "./errors";
import { recordTransaction, validateInput, type Session } from "./journal";

/**
 * What a task's escrow account must hold, under the rules the app follows
 * today (they are what the ledger keeps from now on):
 *
 *   escrow = openSlots * reward  +  sum of payableAmount of pending submissions
 *
 * - `openSlots * reward` = max(0, requiredWorkers - filledWorkers) * payableAmount.
 *   It is what the buyer gets back if they delete the task. It is 0 once the
 *   task is released (`escrowReleasedAt`): the buyer deleted it and the open
 *   slots were refunded.
 * - A pending submission is already counted in `filledWorkers`, and its reward
 *   is paid out of the escrow when the buyer approves it (reward = the
 *   submission's own `payableAmount`, fixed when it was submitted).
 *
 * Creating a submission moves one slot from "open" to "pending" and rejecting
 * moves it back, so neither changes the total; approving pays the reward out;
 * editing the task changes only the open-slot term; deleting refunds it.
 */
export interface TaskValueFields {
  requiredWorkers: number;
  filledWorkers: number;
  payableAmount: number;
  escrowReleasedAt?: Date | null;
}

export function openSlotValue(task: TaskValueFields): number {
  if (task.escrowReleasedAt) return 0;
  return Math.max(0, task.requiredWorkers - task.filledWorkers) * task.payableAmount;
}

/** Sum of the rewards owed to a task's pending submissions. */
export async function pendingSubmissionValue(
  taskId: string | mongoose.Types.ObjectId,
  session?: Session,
): Promise<number> {
  const agg = Submission.aggregate<{ total: number }>([
    {
      $match: {
        taskId: new mongoose.Types.ObjectId(String(taskId)),
        status: "pending",
      },
    },
    { $group: { _id: null, total: { $sum: "$payableAmount" } } },
  ]);
  if (session) agg.session(session);
  const [row] = await agg;
  return row?.total ?? 0;
}

export function expectedEscrow(task: TaskValueFields, pendingValue: number): number {
  return openSlotValue(task) + pendingValue;
}

/** Creates an empty escrow account for a task funded through the ledger. */
export async function createEscrowAccount(
  taskId: string | mongoose.Types.ObjectId,
  session: Session,
): Promise<void> {
  await LedgerAccount.create(
    [{ _id: escrowAccount(taskId), kind: "escrow", balance: 0, allowNegative: false }],
    { session },
  );
}

export interface EscrowOpenResult {
  /** True if this call opened the account (a task from before the ledger). */
  opened: boolean;
  /** Whether the task's open slots are already refunded (see TaskValueFields). */
  released: boolean;
}

/**
 * Lazy opening of an escrow account for a task created before the ledger.
 *
 * Tasks created through the ledger are funded by `task-fund:<id>`, which
 * creates the account, so they never come here. For an older task, on first
 * touch and inside the caller's transaction, this opens `escrow:task:<id>`
 * with the value the task still holds (see `expectedEscrow`), posting a
 * journal-only entry `system:migration -X, escrow +X` (key
 * `opening:escrow:<id>`).
 *
 * An archived task is assumed to have been archived by the buyer deleting it,
 * which refunds the open slots, so it opens with only its pending value and
 * is marked released. (An admin can also archive a task without a refund;
 * that cannot be told apart in old data.)
 *
 * Call this BEFORE changing the task or its submissions in the same
 * transaction: the value is computed from the state the task is in now.
 */
export async function ensureEscrowOpen(
  taskId: string | mongoose.Types.ObjectId,
  session: Session,
): Promise<EscrowOpenResult> {
  const accountId = escrowAccount(taskId);
  const task = await Task.findById(taskId).session(session).lean();
  if (!task) throw new UnknownAccountError(accountId);

  const exists = await LedgerAccount.exists({ _id: accountId }).session(session);
  if (exists) return { opened: false, released: Boolean(task.escrowReleasedAt) };

  const archived = task.status === "archived";
  const released = archived || Boolean(task.escrowReleasedAt);
  const pending = await pendingSubmissionValue(taskId, session);
  const value = expectedEscrow({ ...task, escrowReleasedAt: released ? new Date() : undefined }, pending);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidTransactionError(
      `Task ${String(taskId)} holds a non-integer or negative value (${value}); fix it before opening its escrow`,
    );
  }

  await createEscrowAccount(taskId, session);
  if (value > 0) {
    const input = {
      type: "opening" as const,
      idempotencyKey: `opening:escrow:${String(taskId)}`,
      entries: [
        { accountId: SYSTEM_ACCOUNTS.MIGRATION, amount: -value },
        { accountId, amount: value },
      ],
      meta: { taskId: String(taskId), assumeReleased: archived || undefined },
      createdBy: "system",
    };
    validateInput(input);
    await recordTransaction(input, session, { updateUserBalances: false });
  }
  if (archived && !task.escrowReleasedAt) {
    await Task.updateOne(
      { _id: taskId },
      { $set: { escrowReleasedAt: new Date() } },
      { session },
    );
  }
  return { opened: true, released };
}
