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
import { decideDispute, openDispute } from "@/lib/ledger/flows/disputes";
import Dispute, { ACTIVE_DISPUTE_STATUSES } from "@/models/Dispute";
import {
  approveWithdrawal,
  cancelWithdrawal,
  confirmWithdrawal,
  markWithdrawalPaid,
  rejectWithdrawal,
  requestWithdrawal,
} from "@/lib/ledger/flows/withdrawals";
import { RESERVED_STATUSES } from "@/models/Withdrawal";
import PayoutAccount from "@/models/PayoutAccount";
import { adjustUserCoins, createUserWithBonus, removeUser } from "@/lib/ledger/flows/users";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  // A long window, so rejections stay held and the scenario exercises holds and their settlement.
  process.env.DISPUTE_WINDOW_MS = String(30 * 24 * 3600 * 1000);
  db = await startTestDb("taskhub_ledger_invariants_test");
  await Dispute.init();
  await PayoutAccount.init();
}, 180_000);
afterAll(async () => {
  process.env.DISPUTE_WINDOW_MS = "0";
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Dispute.deleteMany({});
  await PayoutAccount.deleteMany({});
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
  // Coins waiting to be paid out are still in the system until the payout is made.
  const reserved = await Withdrawal.find({ status: { $in: RESERVED_STATUSES }, reservedAt: { $exists: true } }).select("coinRequested").lean();
  total += reserved.reduce((sum, w) => sum + w.coinRequested, 0);
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
    expect(report.payoutsMismatch, context).toBeNull();
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
        "reject", "reject", "settle", "appeal", "appeal", "decide", "decide", "delete", "edit", "edit", "withdraw", "withdraw", "adjust", "signup", "remove",
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
      } else if (kind === "appeal") {
        const held = await Submission.find({
          status: "rejected",
          "rejectionHold.windowEndsAt": { $exists: true },
          "rejectionHold.settledAt": { $exists: false },
        }).select("_id workerId").lean();
        const s = rnd.pick(held);
        if (s) {
          for (let i = rnd.int(1, 2); i > 0; i--) {
            batch.push(
              openDispute({
                submissionId: String(s._id),
                workerId: String(s.workerId),
                statement: "I did exactly what the task asked and attached the proof.",
              }).then((r) => {
                log.push(`APPEAL ${s._id}: ${r.ok ? "ok" : r.reason}`);
                if (r.ok) won("appeal");
              }),
            );
          }
        }
      } else if (kind === "decide") {
        const open = await Dispute.find({ status: { $in: ACTIVE_DISPUTE_STATUSES } }).select("_id").lean();
        const d = rnd.pick(open);
        if (d) {
          // Two admins can decide the same dispute at once; one decision stands.
          for (let i = rnd.int(1, 2); i > 0; i--) {
            const winner = rnd.next() < 0.5 ? "worker" : "buyer";
            batch.push(
              decideDispute({
                disputeId: String(d._id),
                winner,
                note: "Reviewed both sides carefully.",
                adminId: "adm",
                audit: { actorId: "adm", actorRole: "admin" },
              }).then((r) => {
                log.push(`DECIDE ${d._id} ${winner}: ${r.ok ? "ok" : r.reason}`);
                if (r.ok) won(`decide_${winner}`);
              }),
            );
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
        const path = rnd.next();
        batch.push(
          (async () => {
            const req = await requestWithdrawal({
              worker: { id: String(worker), name: "W", email: "w@example.test" },
              coins: 200, paymentSystem: "bkash", accountNumber: "01700000000",
            });
            if (!req.ok) return;
            const id = String(req.withdrawal._id);
            const wid = String(worker);
            won("withdraw_request");
            if (path < 0.2) {
              if ((await cancelWithdrawal({ withdrawalId: id, workerId: wid })).ok) won("withdraw_cancel");
              return;
            }
            const conf = await confirmWithdrawal({ withdrawalId: id, workerId: wid, token: req.confirmToken });
            if (!conf.ok || path < 0.35) return; // stays waiting for an admin
            if (path < 0.55) {
              if ((await rejectWithdrawal({ withdrawalId: id, reason: "Looks wrong to me" })).ok) won("withdraw_reject");
              return;
            }
            const appr = await approveWithdrawal({ withdrawalId: id, adminId: "adm" });
            if (!appr.ok || path < 0.7) return; // approved, not paid yet
            // Two admins may pay the same one at once; the coins leave once.
            const paid = await Promise.all([1, 2].map(() => markWithdrawalPaid({ withdrawalId: id, adminId: "adm", transactionId: "TRX-" + id.slice(-6) })));
            if (paid.some((p) => p.ok)) {
              delta -= 200;
              won("withdraw");
            }
          })(),
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
      for (const kind of ["topup", "create", "approve", "reject", "settle", "appeal", "edit", "withdraw_request", "adjust", "signup"]) {
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
