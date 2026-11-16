import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import Task, { type ITaskDoc } from "@/models/Task";
import type { TaskFormData } from "@/lib/validators/task";
import { escrowAccount, userAccount } from "../accounts";
import { InsufficientCoinsError, UnknownAccountError } from "../errors";
import {
  createEscrowAccount,
  ensureEscrowOpen,
  openSlotValue,
  pendingSubmissionValue,
} from "../escrow";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";
import LedgerTransaction from "@/models/LedgerTransaction";

export type CreateTaskResult =
  | { ok: true; task: ITaskDoc }
  | { ok: false; reason: "insufficient_coins" };

/**
 * Creates a task and funds its escrow in one transaction:
 * `user -cost, escrow:task:<id> +cost` (key `task-fund:<id>`). If the buyer
 * can't afford it, nothing is created.
 */
export async function createFundedTask(args: {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  data: TaskFormData;
}): Promise<CreateTaskResult> {
  const { buyerId, buyerName, buyerEmail, data } = args;
  const cost = data.requiredWorkers * data.payableAmount;
  try {
    const task = await inLedgerTransaction(async (session) => {
      const taskId = new mongoose.Types.ObjectId();
      const [created] = await Task.create(
        [{ ...data, _id: taskId, buyerId, buyerName, buyerEmail, filledWorkers: 0 }],
        { session },
      );
      await createEscrowAccount(taskId, session);
      await postTransaction(
        {
          type: "task_fund",
          idempotencyKey: `task-fund:${taskId}`,
          entries: [
            { accountId: userAccount(buyerId), amount: -cost },
            { accountId: escrowAccount(taskId), amount: cost },
          ],
          meta: { taskId: String(taskId) },
          createdBy: buyerId,
        },
        session,
      );
      return created;
    });
    return { ok: true, task };
  } catch (err) {
    if (err instanceof InsufficientCoinsError || err instanceof UnknownAccountError) {
      return { ok: false, reason: "insufficient_coins" };
    }
    throw err;
  }
}

export type UpdateTaskResult =
  | { ok: true; task: ITaskDoc }
  | { ok: false; reason: "not_found" | "insufficient_coins" | "escrow_insufficient" };

/**
 * Edits a task. If the edit changes the value of its open slots
 * (requiredWorkers x payableAmount), the difference is moved between the
 * buyer and the escrow in the same transaction (key
 * `task-adjust:<id>:<n>`): raising it charges the buyer, lowering it refunds
 * them. A task whose open slots were already refunded (deleted by the buyer)
 * has nothing to adjust.
 */
export async function updateFundedTask(args: {
  taskId: string;
  buyerId: string;
  data: TaskFormData;
}): Promise<UpdateTaskResult> {
  const { taskId, buyerId, data } = args;
  try {
    return await inLedgerTransaction(async (session): Promise<UpdateTaskResult> => {
      const exists = await Task.exists({ _id: taskId, buyerId }).session(session);
      if (!exists) return { ok: false, reason: "not_found" };
      // Open the escrow (pre-ledger tasks) from the state before this edit.
      await ensureEscrowOpen(taskId, session);

      const task = await Task.findOne({ _id: taskId, buyerId }).session(session);
      if (!task) return { ok: false, reason: "not_found" };

      const before = openSlotValue(task);
      Object.assign(task, data);
      const delta = openSlotValue(task) - before;

      if (delta !== 0) {
        const n =
          (await LedgerTransaction.countDocuments({
            type: "task_adjust",
            "meta.taskId": String(task._id),
          }).session(session)) + 1;
        const user = userAccount(buyerId);
        const escrow = escrowAccount(task._id);
        await postTransaction(
          {
            type: "task_adjust",
            idempotencyKey: `task-adjust:${task._id}:${n}`,
            entries:
              delta > 0
                ? [
                    { accountId: user, amount: -delta },
                    { accountId: escrow, amount: delta },
                  ]
                : [
                    { accountId: escrow, amount: delta },
                    { accountId: user, amount: -delta },
                  ],
            meta: { taskId: String(task._id) },
            createdBy: buyerId,
          },
          session,
        );
      }
      await task.save({ session });
      return { ok: true, task };
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      return {
        ok: false,
        reason: err.accountId.startsWith("escrow:") ? "escrow_insufficient" : "insufficient_coins",
      };
    }
    throw err;
  }
}

export type DeleteTaskResult =
  | { ok: true; refunded: number }
  | { ok: false; reason: "not_found" };

/**
 * Deletes (archives) an open task and refunds its open slots from the escrow
 * to the buyer (key `task-refund:<id>`). The refund never exceeds what the
 * escrow holds beyond the rewards owed to pending submissions, which stay in
 * escrow until the buyer approves or rejects them.
 */
export async function deleteFundedTask(args: {
  taskId: string;
  buyerId: string;
}): Promise<DeleteTaskResult> {
  const { taskId, buyerId } = args;
  return inLedgerTransaction(async (session): Promise<DeleteTaskResult> => {
    const exists = await Task.exists({ _id: taskId, buyerId, status: "open" }).session(session);
    if (!exists) return { ok: false, reason: "not_found" };
    await ensureEscrowOpen(taskId, session);

    const task = await Task.findOne({ _id: taskId, buyerId, status: "open" }).session(session);
    if (!task) return { ok: false, reason: "not_found" };

    let refunded = 0;
    if (!task.escrowReleasedAt) {
      const pending = await pendingSubmissionValue(task._id, session);
      const account = await LedgerAccount.findById(escrowAccount(task._id)).session(session);
      const spare = Math.max(0, (account?.balance ?? 0) - pending);
      refunded = Math.min(openSlotValue(task), spare);
      if (refunded > 0) {
        await postTransaction(
          {
            type: "task_refund",
            idempotencyKey: `task-refund:${task._id}`,
            entries: [
              { accountId: escrowAccount(task._id), amount: -refunded },
              { accountId: userAccount(buyerId), amount: refunded },
            ],
            meta: { taskId: String(task._id) },
            createdBy: buyerId,
          },
          session,
        );
      }
      task.escrowReleasedAt = new Date();
    }
    task.status = "archived";
    await task.save({ session });
    return { ok: true, refunded };
  });
}
