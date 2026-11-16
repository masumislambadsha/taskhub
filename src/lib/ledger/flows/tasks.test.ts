import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Task from "@/models/Task";
import {
  coinsOf,
  createPendingSubmission,
  createPreLedgerTask,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import {
  createFundedTask,
  deleteFundedTask,
  updateFundedTask,
} from "@/lib/ledger/flows/tasks";
import { escrowAccount } from "@/lib/ledger";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_tasks_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

const escrowOf = async (taskId: unknown) =>
  (await LedgerAccount.findById(escrowAccount(String(taskId))))?.balance;

const create = (buyer: { _id: unknown }, input = taskInput()) =>
  createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "Buyer",
    buyerEmail: "buyer@example.test",
    data: input,
  });

describe("createFundedTask", () => {
  it("creates the task and moves the cost from the buyer into escrow", async () => {
    const buyer = await createUser(100);
    const res = await create(buyer, taskInput({ requiredWorkers: 3, payableAmount: 10 }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(await coinsOf(buyer._id)).toBe(70);
    expect(await escrowOf(res.task._id)).toBe(30);
    const row = await LedgerTransaction.findOne({ idempotencyKey: `task-fund:${res.task._id}` });
    expect(row?.type).toBe("task_fund");
    expect(row?.meta.taskId).toBe(String(res.task._id));
    expect(row?.createdBy).toBe(String(buyer._id));
    expect(res.task.status).toBe("open");
    expect(res.task.filledWorkers).toBe(0);
  });

  it("refuses when the buyer cannot afford it and creates nothing", async () => {
    const buyer = await createUser(29);
    const res = await create(buyer, taskInput({ requiredWorkers: 3, payableAmount: 10 }));
    expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await coinsOf(buyer._id)).toBe(29);
    expect(await Task.countDocuments({})).toBe(0);
    expect(await LedgerTransaction.countDocuments({ type: "task_fund" })).toBe(0);
  });

  it("refuses for a user that does not exist", async () => {
    const res = await create({ _id: new mongoose.Types.ObjectId() });
    expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await Task.countDocuments({})).toBe(0);
  });

  it("20 concurrent creations from a buyer who can afford exactly 2: exactly 2 succeed", async () => {
    const buyer = await createUser(100); // pre-ledger buyer: also exercises lazy opening
    const input = taskInput({ requiredWorkers: 5, payableAmount: 10 }); // costs 50
    const results = await Promise.all(Array.from({ length: 20 }, () => create(buyer, input)));

    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(2);
    expect(results.filter((r) => !r.ok)).toHaveLength(18);
    expect(await coinsOf(buyer._id)).toBe(0);
    expect(await Task.countDocuments({})).toBe(2);
    expect(await LedgerTransaction.countDocuments({ type: "task_fund" })).toBe(2);
    for (const r of ok) {
      if (r.ok) expect(await escrowOf(r.task._id)).toBe(50);
    }
    expect(await LedgerTransaction.countDocuments({ type: "opening" })).toBe(1);
  });
});

describe("updateFundedTask", () => {
  async function funded(coins = 200, workers = 5, reward = 10) {
    const buyer = await createUser(coins);
    const res = await create(buyer, taskInput({ requiredWorkers: workers, payableAmount: reward }));
    if (!res.ok) throw new Error("setup failed");
    return { buyer, task: res.task };
  }

  const edit = (buyer: { _id: unknown }, task: { _id: unknown }, overrides: Parameters<typeof taskInput>[0]) =>
    updateFundedTask({
      taskId: String(task._id),
      buyerId: String(buyer._id),
      data: taskInput(overrides),
    });

  it("charges the buyer for a higher cost", async () => {
    const { buyer, task } = await funded(); // 200 - 50 = 150, escrow 50
    const res = await edit(buyer, task, { requiredWorkers: 5, payableAmount: 12 });
    expect(res.ok).toBe(true);
    expect(await coinsOf(buyer._id)).toBe(150 - 10);
    expect(await escrowOf(task._id)).toBe(60);
    const row = await LedgerTransaction.findOne({ idempotencyKey: `task-adjust:${task._id}:1` });
    expect(row?.type).toBe("task_adjust");
    expect((await Task.findById(task._id))?.payableAmount).toBe(12);
  });

  it("refunds the buyer for a lower cost, with a new key each edit", async () => {
    const { buyer, task } = await funded();
    await edit(buyer, task, { requiredWorkers: 3, payableAmount: 10 });
    expect(await coinsOf(buyer._id)).toBe(150 + 20);
    expect(await escrowOf(task._id)).toBe(30);
    await edit(buyer, task, { requiredWorkers: 3, payableAmount: 5 });
    expect(await coinsOf(buyer._id)).toBe(170 + 15);
    expect(await escrowOf(task._id)).toBe(15);
    expect(await LedgerTransaction.countDocuments({ type: "task_adjust" })).toBe(2);
  });

  it("posts nothing when the edit does not change the cost", async () => {
    const { buyer, task } = await funded();
    const res = await updateFundedTask({
      taskId: String(task._id),
      buyerId: String(buyer._id),
      data: { ...taskInput(), title: "A brand new title" },
    });
    expect(res.ok).toBe(true);
    expect(await LedgerTransaction.countDocuments({ type: "task_adjust" })).toBe(0);
    expect((await Task.findById(task._id))?.title).toBe("A brand new title");
  });

  it("refuses a cost the buyer cannot afford and leaves the task unchanged", async () => {
    const { buyer, task } = await funded(60); // 60 - 50 = 10 left
    const res = await edit(buyer, task, { requiredWorkers: 5, payableAmount: 14 }); // +20
    expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await coinsOf(buyer._id)).toBe(10);
    expect(await escrowOf(task._id)).toBe(50);
    expect((await Task.findById(task._id))?.payableAmount).toBe(10);
  });

  it("does not count filled slots as refundable when lowering the worker count", async () => {
    const { buyer, task } = await funded(); // W=5, R=10, escrow 50
    const worker = await createUser(0);
    await createPendingSubmission(task, worker._id);
    await createPendingSubmission(task, worker._id); // F=2, pending value 20
    // New W=2: open slots 0, so the open-slot value drops from 30 to 0.
    await edit(buyer, task, { requiredWorkers: 2, payableAmount: 10 });
    expect(await escrowOf(task._id)).toBe(20); // exactly the pending submissions
    expect(await coinsOf(buyer._id)).toBe(150 + 30);
  });

  it("returns not_found for another buyer's task", async () => {
    const { task } = await funded();
    const other = await createUser(500);
    const res = await edit(other, task, { requiredWorkers: 9, payableAmount: 10 });
    expect(res).toEqual({ ok: false, reason: "not_found" });
    expect(await coinsOf(other._id)).toBe(500);
  });
});

describe("deleteFundedTask", () => {
  it("refunds the open slots from escrow to the buyer, once", async () => {
    const buyer = await createUser(100);
    const res = await create(buyer, taskInput({ requiredWorkers: 4, payableAmount: 10 }));
    if (!res.ok) throw new Error("setup failed");

    const first = await deleteFundedTask({ taskId: String(res.task._id), buyerId: String(buyer._id) });
    expect(first).toEqual({ ok: true, refunded: 40 });
    expect(await coinsOf(buyer._id)).toBe(100);
    expect(await escrowOf(res.task._id)).toBe(0);
    const saved = await Task.findById(res.task._id);
    expect(saved?.status).toBe("archived");
    expect(saved?.escrowReleasedAt).toBeInstanceOf(Date);

    const second = await deleteFundedTask({ taskId: String(res.task._id), buyerId: String(buyer._id) });
    expect(second).toEqual({ ok: false, reason: "not_found" });
    expect(await coinsOf(buyer._id)).toBe(100);
  });

  it("10 concurrent deletes refund once", async () => {
    const buyer = await createUser(100);
    const res = await create(buyer, taskInput({ requiredWorkers: 4, payableAmount: 10 }));
    if (!res.ok) throw new Error("setup failed");
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        deleteFundedTask({ taskId: String(res.task._id), buyerId: String(buyer._id) }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await coinsOf(buyer._id)).toBe(100);
    expect(await LedgerTransaction.countDocuments({ type: "task_refund" })).toBe(1);
  });

  it("keeps the reward of pending submissions in escrow", async () => {
    const buyer = await createUser(100);
    const worker = await createUser(0);
    const res = await create(buyer, taskInput({ requiredWorkers: 4, payableAmount: 10 }));
    if (!res.ok) throw new Error("setup failed");
    await createPendingSubmission(res.task, worker._id);

    const del = await deleteFundedTask({ taskId: String(res.task._id), buyerId: String(buyer._id) });
    expect(del).toEqual({ ok: true, refunded: 30 });
    expect(await coinsOf(buyer._id)).toBe(100 - 40 + 30);
    expect(await escrowOf(res.task._id)).toBe(10);
  });

  it("never refunds more than the escrow holds", async () => {
    const buyer = await createUser(100);
    const res = await create(buyer, taskInput({ requiredWorkers: 4, payableAmount: 10 }));
    if (!res.ok) throw new Error("setup failed");
    // Corrupt the task so it claims 100 open slots (as the old edit hole allowed).
    await Task.updateOne({ _id: res.task._id }, { requiredWorkers: 100 });
    const del = await deleteFundedTask({ taskId: String(res.task._id), buyerId: String(buyer._id) });
    expect(del).toEqual({ ok: true, refunded: 40 });
    expect(await escrowOf(res.task._id)).toBe(0);
    expect(await coinsOf(buyer._id)).toBe(100);
  });

  it("a buyer cannot raise the payout and delete to print coins", async () => {
    const buyer = await createUser(100);
    const res = await create(buyer, taskInput({ requiredWorkers: 1, payableAmount: 10 }));
    if (!res.ok) throw new Error("setup failed");
    const raised = await updateFundedTask({
      taskId: String(res.task._id),
      buyerId: String(buyer._id),
      data: taskInput({ requiredWorkers: 1, payableAmount: 5000 }),
    });
    expect(raised).toEqual({ ok: false, reason: "insufficient_coins" });
    await deleteFundedTask({ taskId: String(res.task._id), buyerId: String(buyer._id) });
    expect(await coinsOf(buyer._id)).toBe(100);
  });
});

describe("tasks created before the ledger", () => {
  it("delete opens the escrow from today's rules, then refunds the open slots", async () => {
    // Bought for 5 x 10 = 50. 2 approved and paid out, 1 pending: F = 3.
    const buyer = await createUser(30);
    const worker = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, {
      requiredWorkers: 5,
      filledWorkers: 2,
      payableAmount: 10,
    });
    await createPendingSubmission(task, worker._id); // F = 3, pending 10

    const del = await deleteFundedTask({ taskId: String(task._id), buyerId: String(buyer._id) });
    // Escrow opened with (5-3)*10 + 10 = 30; the refund is the open slots, 20.
    expect(del).toEqual({ ok: true, refunded: 20 });
    expect(await coinsOf(buyer._id)).toBe(50);
    expect(await escrowOf(task._id)).toBe(10);
    const opening = await LedgerTransaction.findOne({ idempotencyKey: `opening:escrow:${task._id}` });
    expect(opening?.entries.find((e) => e.accountId === escrowAccount(String(task._id)))?.amount).toBe(30);
  });
});
