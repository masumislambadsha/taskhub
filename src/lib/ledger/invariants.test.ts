import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerTransaction from "@/models/LedgerTransaction";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import {
  createPayment,
  createPendingSubmission,
  createPreLedgerTask,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { creditPayment } from "@/lib/payments/credit";
import { expectedEscrow, pendingSubmissionValue } from "@/lib/ledger/escrow";
import { reconcile } from "@/lib/ledger/reconcile";
import { createFundedTask, deleteFundedTask, updateFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission, rejectSubmission, settleRejection } from "@/lib/ledger/flows/submissions";
import { approveWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { adjustUserCoins, createUserWithBonus, removeUser } from "@/lib/ledger/flows/users";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  // A long window, so rejections stay held and the scenario exercises holds and their settlement.
  process.env.DISPUTE_WINDOW_MS = String(30 * 24 * 3600 * 1000);
  db = await startTestDb("taskhub_ledger_invariants_test");
}, 180_000);
afterAll(async () => {
  process.env.DISPUTE_WINDOW_MS = "0";
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

/** A small seeded PRNG (mulberry32) so a failing run can be replayed. */
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: T[]): T | undefined => items[Math.floor(next() * items.length)],
  };
}

/**
 * Coins that exist outside the journal's view: every user's balance plus the
 * value every task says it holds. Only top-ups, bonuses, adjustments,
 * withdrawals and forfeits may change it.
 */
async function totalCoins(): Promise<number> {
  const users = await User.find({}).select("coins").lean();
  let total = users.reduce((sum, u) => sum + (u.coins ?? 0), 0);
  for (const task of await Task.find({}).lean()) {
    total += expectedEscrow(task, await pendingSubmissionValue(task._id));
  }
  return total;
}

async function runScenario(seed: number, totalOps: number) {
  const rnd = prng(seed);
  const log: string[] = [];
  const buyers: mongoose.Types.ObjectId[] = [];
  const workers: mongoose.Types.ObjectId[] = [];
  const tasks: mongoose.Types.ObjectId[] = [];

  // Starting state: half of it from before the ledger.
  for (let i = 0; i < 4; i++) buyers.push((await createUser(rnd.int(0, 600)))._id);
  for (let i = 0; i < 6; i++) workers.push((await createUser(rnd.int(0, 400)))._id);
  for (let i = 0; i < 6; i++) {
    const buyer = rnd.pick(buyers)!;
    const requiredWorkers = rnd.int(2, 6);
    const approved = rnd.int(0, 1);
    const task = await createPreLedgerTask(buyer, {
      requiredWorkers,
      filledWorkers: approved,
      payableAmount: rnd.int(1, 15),
    });
    tasks.push(task._id);
    for (let k = rnd.int(0, 2); k > 0; k--) {
      const fresh = await Task.findById(task._id);
      if (fresh && fresh.filledWorkers < fresh.requiredWorkers) {
        await createPendingSubmission(fresh, rnd.pick(workers)!);
      }
    }
  }

  const stats: Record<string, number> = {};
  const won = (name: string) => {
    stats[name] = (stats[name] ?? 0) + 1;
  };
  const base = await totalCoins();
  let delta = 0; // coins that legitimately entered or left
  let ops = 0;
  let payments = 0;

  const check = async (label: string) => {
    const report = await reconcile();
    const context = `seed ${seed}, after ${label}\n${log.slice(-12).join("\n")}\n${JSON.stringify(report)}`;
    expect(report.balanceMismatches, context).toEqual([]);
    expect(report.escrowMismatches, context).toEqual([]);
    expect(report.negativeBalances, context).toEqual([]);
    expect(report.globalJournalSum, context).toBe(0);
    expect(report.globalCachedSum, context).toBe(0);
    expect(await User.countDocuments({ coins: { $lt: 0 } }), context).toBe(0);
    expect(await totalCoins(), context).toBe(base + delta);
  };

  while (ops < totalOps) {
    // Worker submissions are plain writes (as in the app), so they run alone.
    for (let k = rnd.int(0, 2); k > 0; k--) {
      const open = await Task.find({ status: "open" }).select("_id filledWorkers requiredWorkers").lean();
      const candidates = open.filter((t) => t.filledWorkers < t.requiredWorkers);
      const t = rnd.pick(candidates);
      if (t) {
        await createPendingSubmission({ _id: t._id, buyerId: (await Task.findById(t._id))!.buyerId }, rnd.pick(workers)!);
        log.push(`submit ${t._id}`);
        ops++;
      }
    }

    // The money operations of one round run concurrently.
    const batch: Promise<void>[] = [];
    for (let k = rnd.int(1, 6); k > 0; k--, ops++) {
      const kind = rnd.pick([
        "topup", "topup", "create", "create", "create", "approve", "approve", "approve",
        "reject", "reject", "settle", "settle", "delete", "edit", "edit", "withdraw", "withdraw", "adjust", "signup", "remove",
      ])!;
      log.push(kind);
      if (kind === "topup") {
        const user = rnd.pick(buyers)!;
        const coins = rnd.pick([10, 150, 500])!;
        payments++;
        const payment = await createPayment(user, { coins, price: coins / 10 });
        batch.push(
          creditPayment({
            paymentId: String(payment._id),
            gateway: { name: "sslcommerz", transactionId: `T${seed}-${payments}`, validationId: `V${seed}-${payments}` },
          }).then((r) => {
            if (r.credited) {
              delta += coins;
              won("topup");
            }
          }),
        );
      } else if (kind === "create") {
        const buyer = rnd.pick(buyers)!;
        batch.push(
          createFundedTask({
            buyerId: String(buyer),
            buyerName: "B",
            buyerEmail: "b@example.test",
            data: taskInput({ requiredWorkers: rnd.int(1, 5), payableAmount: rnd.int(1, 25) }),
          }).then((r) => {
            if (r.ok) {
              tasks.push(r.task._id);
              won("create");
            }
          }),
        );
      } else if (kind === "approve" || kind === "reject") {
        const pending = await Submission.find({ status: "pending" }).select("_id taskBuyerId").lean();
        const s = rnd.pick(pending);
        if (s) {
          const args = { submissionId: String(s._id), buyerId: String(s.taskBuyerId) };
          // Sometimes the same submission is acted on twice at once.
          const times = rnd.int(1, 3);
          for (let i = 0; i < times; i++) {
            batch.push((kind === "approve" ? approveSubmission(args) : rejectSubmission(args)).then((r) => {
              log.push(`${kind.toUpperCase()} ${s._id}: ${r.ok ? "ok" : r.reason}`);
              if (r.ok) won(kind);
            }));
          }
        }
      } else if (kind === "settle") {
        const held = await Submission.find({
          status: "rejected",
          "rejectionHold.windowEndsAt": { $exists: true },
          "rejectionHold.settledAt": { $exists: false },
        }).select("_id").lean();
        const s = rnd.pick(held);
        if (s) {
          // Accept, the window job and the sweep can all arrive together.
          for (let i = rnd.int(1, 3); i > 0; i--) {
            batch.push(settleRejection({ submissionId: String(s._id), via: i % 2 ? "accepted" : "window" }).then((r) => {
              log.push(`SETTLE ${s._id}: ${r.ok ? r.outcome : r.reason}`);
              if (r.ok) won("settle");
            }));
          }
        }
      } else if (kind === "delete" || kind === "edit") {
        const t = rnd.pick(tasks);
        const task = t && (await Task.findById(t).lean());
        if (task) {
          if (kind === "delete") {
            batch.push(deleteFundedTask({ taskId: String(task._id), buyerId: String(task.buyerId) }).then((r) => {
              log.push(`DELETE ${task._id}: ${JSON.stringify(r)}`);
              if (r.ok) won("delete");
            }));
          } else {
            batch.push(
              (async () => {
                const data = taskInput({ requiredWorkers: rnd.int(1, 6), payableAmount: rnd.int(1, 25) });
                const r = await updateFundedTask({ taskId: String(task._id), buyerId: String(task.buyerId), data });
                log.push(`EDIT ${task._id} -> W${data.requiredWorkers} R${data.payableAmount}: ${r.ok ? "ok" : r.reason}`);
                if (r.ok) won("edit");
              })(),
            );
          }
        }
      } else if (kind === "withdraw") {
        const worker = rnd.pick(workers)!;
        const w = await Withdrawal.create({
          workerId: worker, workerName: "W", workerEmail: "w@example.test",
          coinRequested: 200, amount: 10, paymentSystem: "bkash", accountNumber: "017",
        });
        batch.push(
          approveWithdrawal({ withdrawalId: String(w._id), adminId: "adm" }).then((r) => {
            if (r.ok) {
              delta -= 200;
              won("withdraw");
            }
          }),
        );
      } else if (kind === "adjust") {
        const user = rnd.pick([...buyers, ...workers])!;
        const amount = rnd.int(-120, 250) || 1;
        batch.push(
          adjustUserCoins({ userId: String(user), delta: amount, adminId: "adm", requestId: `a${seed}-${ops}-${k}` }).then((r) => {
            if (r.ok) {
              delta += amount;
              won("adjust");
            }
          }),
        );
      } else if (kind === "signup") {
        batch.push(
          createUserWithBonus({
            data: { name: "N", email: `n${seed}-${ops}-${k}@example.test`, role: "worker" },
            bonus: 10,
          }).then(({ userId }) => {
            delta += 10;
            won("signup");
            workers.push(new mongoose.Types.ObjectId(userId));
          }),
        );
      } else if (kind === "remove" && rnd.next() < 0.3 && workers.length > 3) {
        const victim = workers.splice(rnd.int(0, workers.length - 1), 1)[0];
        batch.push(
          removeUser({ userId: String(victim), adminId: "adm" }).then((r) => {
            if (r.ok) {
              delta -= r.forfeited;
              won("remove");
            }
          }),
        );
      }
    }
    await Promise.all(batch);
    await check(`op ${ops}`);
  }
  return { ops, stats };
}

describe("randomized operations keep every invariant", () => {
  for (const seed of [20261116, 7, 424242]) {
    it(`seed ${seed}: ~200 operations of top-ups, task creation, approvals, refunds and withdrawals`, async () => {
      const { ops, stats } = await runScenario(seed, 200);
      expect(ops).toBeGreaterThanOrEqual(200);
      // The run really exercised each kind of movement, not just failed attempts.
      for (const kind of ["topup", "create", "approve", "edit", "withdraw", "adjust", "signup"]) {
        expect(stats[kind] ?? 0, `${kind} never succeeded: ${JSON.stringify(stats)}`).toBeGreaterThan(0);
      }
      if (process.env.LEDGER_STATS) console.log(seed, JSON.stringify(stats));
      // Every journal row is balanced on its own.
      const unbalanced = await LedgerTransaction.aggregate([
        { $project: { sum: { $sum: "$entries.amount" } } },
        { $match: { sum: { $ne: 0 } } },
      ]);
      expect(unbalanced).toEqual([]);
    }, 300_000);
  }
});
