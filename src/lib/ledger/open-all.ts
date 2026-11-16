import LedgerAccount from "@/models/LedgerAccount";
import Task from "@/models/Task";
import User from "@/models/User";
import {
  ensureEscrowOpen,
  expectedEscrow,
  pendingSubmissionValue,
} from "./escrow";
import { ensureUserOpen } from "./opening";
import { inLedgerTransaction } from "./run";
import { escrowAccount } from "./accounts";

export interface OpenFailure {
  id: string;
  reason: string;
}

export interface OpenAllReport {
  dryRun: boolean;
  /** True if `limit` stopped the run early: run it again to continue. */
  truncated: boolean;
  users: {
    /** Users that were not open (dry run) or that this run opened. */
    count: number;
    /** Sum of their coins: what `system:migration` absorbs for users. */
    coins: number;
    failed: OpenFailure[];
  };
  tasks: {
    count: number;
    /** Sum of the escrow values opened: what `system:migration` absorbs for tasks. */
    value: number;
    /** Archived tasks opened with only their pending value (assumed refunded). */
    archivedAssumedRefunded: number;
    /** Archived tasks with nothing pending, left without an escrow account. */
    skippedArchived: number;
    failed: OpenFailure[];
  };
}

/**
 * Opens every user and every active task that is not open yet, so the ledger
 * covers them without waiting for their first posting. Idempotent: a second
 * run finds nothing to open. Safe to run while the app is live: each account
 * is opened in its own transaction, the same one lazy opening uses.
 *
 * "Active" tasks are every task that is not archived, plus archived ones that
 * still owe a reward to a pending submission. With `dryRun` (the default for
 * the script and the admin endpoint) it only counts and sums, and reports
 * accounts that cannot be opened (a non-integer balance) in `failed`.
 */
export async function openAll(options: {
  dryRun: boolean;
  /** Stop after this many accounts (users and tasks together). */
  limit?: number;
}): Promise<OpenAllReport> {
  const { dryRun } = options;
  const limit = options.limit ?? Infinity;
  const report: OpenAllReport = {
    dryRun,
    truncated: false,
    users: { count: 0, coins: 0, failed: [] },
    tasks: {
      count: 0,
      value: 0,
      archivedAssumedRefunded: 0,
      skippedArchived: 0,
      failed: [],
    },
  };
  let processed = 0;

  const users = User.find({ ledgerOpenedAt: { $exists: false } })
    .select("coins")
    .sort({ _id: 1 })
    .cursor();
  for await (const user of users) {
    if (processed >= limit) {
      report.truncated = true;
      await users.close();
      break;
    }
    processed++;
    const id = String(user._id);
    const coins = user.coins ?? 0;
    if (dryRun) {
      if (Number.isSafeInteger(coins)) {
        report.users.count++;
        report.users.coins += coins;
      } else {
        report.users.failed.push({ id, reason: `non-integer balance ${coins}` });
      }
      continue;
    }
    try {
      const opened = await inLedgerTransaction((session) => ensureUserOpen(id, session));
      if (opened) {
        report.users.count++;
        report.users.coins += coins;
      }
    } catch (err) {
      report.users.failed.push({ id, reason: (err as Error).message });
    }
  }
  if (report.truncated) return report;

  const open = new Set(
    (await LedgerAccount.find({ kind: "escrow" }).select("_id").lean()).map((a) => a._id),
  );
  const tasks = Task.find({}).select("_id status").sort({ _id: 1 }).cursor();
  for await (const task of tasks) {
    const id = String(task._id);
    if (open.has(escrowAccount(id))) continue;
    if (processed >= limit) {
      report.truncated = true;
      await tasks.close();
      break;
    }
    const archived = task.status === "archived";
    if (archived && (await pendingSubmissionValue(id)) === 0) {
      report.tasks.skippedArchived++;
      continue;
    }
    processed++;

    if (dryRun) {
      const full = await Task.findById(id).lean();
      const pending = await pendingSubmissionValue(id);
      const value = full
        ? expectedEscrow({ ...full, escrowReleasedAt: archived ? new Date() : full.escrowReleasedAt }, pending)
        : 0;
      if (Number.isSafeInteger(value) && value >= 0) {
        report.tasks.count++;
        report.tasks.value += value;
        if (archived) report.tasks.archivedAssumedRefunded++;
      } else {
        report.tasks.failed.push({ id, reason: `non-integer or negative value ${value}` });
      }
      continue;
    }
    try {
      const result = await inLedgerTransaction(async (session) => {
        const before = await LedgerAccount.exists({ _id: escrowAccount(id) }).session(session);
        if (before) return null;
        const { opened } = await ensureEscrowOpen(id, session);
        const balance = (await LedgerAccount.findById(escrowAccount(id)).session(session))?.balance ?? 0;
        return opened ? balance : null;
      });
      if (result !== null) {
        report.tasks.count++;
        report.tasks.value += result;
        if (archived) report.tasks.archivedAssumedRefunded++;
      }
    } catch (err) {
      report.tasks.failed.push({ id, reason: (err as Error).message });
    }
  }
  return report;
}
