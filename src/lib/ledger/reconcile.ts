import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Task from "@/models/Task";
import User from "@/models/User";
import Withdrawal, { RESERVED_STATUSES } from "@/models/Withdrawal";
import { SYSTEM_ACCOUNTS, escrowAccount, parseAccount, userAccount } from "./accounts";
import { expectedEscrow, pendingSubmissionValue } from "./escrow";
import type { Session } from "./journal";

export interface BalanceMismatch {
  accountId: string;
  /** The cached balance (User.coins or ledger_accounts.balance); 0 if the account has none. */
  cached: number;
  /** The balance recomputed from the journal. */
  journal: number;
}

export interface EscrowMismatch {
  accountId: string;
  taskId: string;
  /** The escrow's cached balance. */
  balance: number;
  /** What the task says it should hold; null if the task no longer exists. */
  expected: number | null;
}

export interface ReconcileReport {
  ok: boolean;
  checkedAt: string;
  counts: {
    journalTransactions: number;
    userAccounts: number;
    ledgerAccounts: number;
    escrowAccounts: number;
  };
  /** Sum of every journal entry. Must be 0. */
  globalJournalSum: number;
  /** Sum of every cached balance (opened users + ledger accounts). Must be 0. */
  globalCachedSum: number;
  balanceMismatches: BalanceMismatch[];
  /** Non-negative accounts (users, escrows) whose cached balance is below 0. */
  negativeBalances: { accountId: string; balance: number }[];
  escrowMismatches: EscrowMismatch[];
  /**
   * `system:payouts_pending` must hold exactly the coins of withdrawals that
   * are reserved and not yet paid or returned. Null when it does.
   */
  payoutsMismatch: { balance: number; expected: number } | null;
  /** Information only: not errors. Opened by first touch or `npm run ledger:open`. */
  unopened: { users: number; tasksWithoutEscrow: number };
}

/**
 * Recomputes every account's balance from the journal and compares it with the
 * cache (`User.coins` for opened users, `ledger_accounts.balance` for the
 * rest), checks that the journal and the cached balances each sum to 0, that
 * no user or escrow is negative, and that every escrow matches its task (see
 * `expectedEscrow`). Read-only. IDs and amounts only.
 *
 * By default it reads one snapshot, so postings that commit while it runs
 * cannot cause false mismatches; that is a long read transaction, so on a very
 * large database pass `{ consistent: false }` and run it when traffic is low.
 */
export async function reconcile(
  options: { consistent?: boolean } = {},
): Promise<ReconcileReport> {
  if (options.consistent === false) return run(undefined);
  return mongoose.connection.transaction((session) => run(session), {
    readConcern: { level: "snapshot" },
  });
}

async function run(session: Session | undefined): Promise<ReconcileReport> {
  const withSession = <Q extends { session(s: Session): Q }>(q: Q): Q =>
    session ? q.session(session) : q;

  // Journal sums per account.
  const journal = new Map<string, number>();
  let globalJournalSum = 0;
  const agg = LedgerTransaction.aggregate<{ _id: string; sum: number }>([
    { $unwind: "$entries" },
    { $group: { _id: "$entries.accountId", sum: { $sum: "$entries.amount" } } },
  ]);
  if (session) agg.session(session);
  for (const row of await agg) {
    journal.set(row._id, row.sum);
    globalJournalSum += row.sum;
  }
  const journalTransactions = await withSession(LedgerTransaction.countDocuments({}));

  const report: ReconcileReport = {
    ok: false,
    checkedAt: new Date().toISOString(),
    counts: { journalTransactions, userAccounts: 0, ledgerAccounts: 0, escrowAccounts: 0 },
    globalJournalSum,
    globalCachedSum: 0,
    balanceMismatches: [],
    negativeBalances: [],
    escrowMismatches: [],
    payoutsMismatch: null,
    unopened: { users: 0, tasksWithoutEscrow: 0 },
  };

  // Opened users: the cache is User.coins.
  const users = withSession(
    User.find({ ledgerOpenedAt: { $exists: true } }).select("coins").sort({ _id: 1 }).lean(),
  ).cursor();
  for await (const user of users) {
    const accountId = userAccount(user._id);
    const cached = user.coins ?? 0;
    const fromJournal = journal.get(accountId) ?? 0;
    journal.delete(accountId);
    report.counts.userAccounts++;
    report.globalCachedSum += cached;
    if (cached !== fromJournal) {
      report.balanceMismatches.push({ accountId, cached, journal: fromJournal });
    }
    if (cached < 0) report.negativeBalances.push({ accountId, balance: cached });
  }
  report.unopened.users = await withSession(
    User.countDocuments({ ledgerOpenedAt: { $exists: false } }),
  );

  // System and escrow accounts.
  const escrowIds = new Set<string>();
  const accounts = withSession(LedgerAccount.find({}).sort({ _id: 1 }).lean()).cursor();
  for await (const account of accounts) {
    const fromJournal = journal.get(account._id) ?? 0;
    journal.delete(account._id);
    report.counts.ledgerAccounts++;
    report.globalCachedSum += account.balance;
    if (account.balance !== fromJournal) {
      report.balanceMismatches.push({
        accountId: account._id,
        cached: account.balance,
        journal: fromJournal,
      });
    }
    if (!account.allowNegative && account.balance < 0) {
      report.negativeBalances.push({ accountId: account._id, balance: account.balance });
    }
    if (account.kind === "escrow") {
      report.counts.escrowAccounts++;
      escrowIds.add(account._id);
      const parsed = parseAccount(account._id);
      const taskId = parsed?.kind === "escrow" ? parsed.taskId : account._id;
      const task = await withSession(Task.findById(taskId).lean());
      if (!task) {
        report.escrowMismatches.push({
          accountId: account._id,
          taskId,
          balance: account.balance,
          expected: null,
        });
        continue;
      }
      const pending = await pendingSubmissionValue(task._id, session);
      const expected = expectedEscrow(task, pending);
      if (account.balance !== expected) {
        report.escrowMismatches.push({
          accountId: account._id,
          taskId,
          balance: account.balance,
          expected,
        });
      }
    }
  }

  // Journal accounts with no cached balance anywhere: a removed user, or an
  // account that was never created. Their cache is 0.
  for (const [accountId, fromJournal] of journal) {
    if (fromJournal !== 0) {
      report.balanceMismatches.push({ accountId, cached: 0, journal: fromJournal });
    }
  }

  // Information: tasks from before the ledger that are not open yet.
  const tasks = withSession(Task.find({ status: { $ne: "archived" } }).select("_id").lean()).cursor();
  for await (const task of tasks) {
    if (!escrowIds.has(escrowAccount(task._id))) report.unopened.tasksWithoutEscrow++;
  }

  // Coins waiting to be paid out: the account must equal the open withdrawals.
  const payoutsAgg = Withdrawal.aggregate<{ total: number }>([
    { $match: { status: { $in: RESERVED_STATUSES }, reservedAt: { $exists: true } } },
    { $group: { _id: null, total: { $sum: "$coinRequested" } } },
  ]);
  if (session) payoutsAgg.session(session);
  const expectedPayouts = (await payoutsAgg)[0]?.total ?? 0;
  const payoutsAccount = await withSession(
    LedgerAccount.findById(SYSTEM_ACCOUNTS.PAYOUTS_PENDING).lean(),
  );
  const payoutsBalance = payoutsAccount?.balance ?? 0;
  if (payoutsBalance !== expectedPayouts) {
    report.payoutsMismatch = { balance: payoutsBalance, expected: expectedPayouts };
  }

  report.ok =
    report.payoutsMismatch === null &&
    report.balanceMismatches.length === 0 &&
    report.negativeBalances.length === 0 &&
    report.escrowMismatches.length === 0 &&
    report.globalJournalSum === 0 &&
    report.globalCachedSum === 0;
  return report;
}
