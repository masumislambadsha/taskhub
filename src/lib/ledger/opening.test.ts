import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Task from "@/models/Task";
import User from "@/models/User";
import {
  createPendingSubmission,
  createPreLedgerTask,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { escrowAccount, inLedgerTransaction, InvalidTransactionError } from "@/lib/ledger";
import { ensureEscrowOpen } from "@/lib/ledger/escrow";
import { openAll } from "@/lib/ledger/open-all";
import { createFundedTask } from "@/lib/ledger/flows/tasks";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_opening_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

const balance = async (id: string) => (await LedgerAccount.findById(id))?.balance;
const openEscrow = (taskId: unknown) =>
  inLedgerTransaction((session) => ensureEscrowOpen(String(taskId), session));

describe("escrow value of a task from before the ledger", () => {
  it("open task: remaining slots x reward plus pending rewards", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    // W=5, R=10; 2 approved earlier (paid out), 1 pending: F = 3.
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 5, filledWorkers: 2, payableAmount: 10 });
    await createPendingSubmission(task, worker._id);
    const res = await openEscrow(task._id);
    expect(res).toEqual({ opened: true, released: false });
    expect(await balance(escrowAccount(String(task._id)))).toBe((5 - 3) * 10 + 10);
    expect(await balance("system:migration")).toBe(-30);
  });

  it("a full (closed) task holds only its pending rewards", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 2, filledWorkers: 0, payableAmount: 7 });
    await createPendingSubmission(task, worker._id);
    await createPendingSubmission(task, worker._id);
    expect((await Task.findById(task._id))?.status).toBe("closed");
    await openEscrow(task._id);
    expect(await balance(escrowAccount(String(task._id)))).toBe(14);
  });

  it("a blocked task keeps its open slots", async () => {
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 4, payableAmount: 5, status: "blocked" });
    await openEscrow(task._id);
    expect(await balance(escrowAccount(String(task._id)))).toBe(20);
  });

  it("uses each pending submission's own reward, not the task's current one", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 3, payableAmount: 10 });
    await createPendingSubmission(task, worker._id); // snapshot reward 10
    await Task.updateOne({ _id: task._id }, { payableAmount: 12 }); // edited afterwards
    await openEscrow(task._id);
    expect(await balance(escrowAccount(String(task._id)))).toBe(2 * 12 + 10);
  });

  it("an archived task is assumed refunded: pending rewards only, and marked released", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 5, payableAmount: 10 });
    await createPendingSubmission(task, worker._id);
    await Task.updateOne({ _id: task._id }, { status: "archived" });
    const res = await openEscrow(task._id);
    expect(res.released).toBe(true);
    expect(await balance(escrowAccount(String(task._id)))).toBe(10);
    expect((await Task.findById(task._id))?.escrowReleasedAt).toBeInstanceOf(Date);
    const row = await LedgerTransaction.findOne({ idempotencyKey: `opening:escrow:${task._id}` });
    expect(row?.meta.assumeReleased).toBe(true);
  });

  it("an empty escrow is opened without a journal row", async () => {
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 2, filledWorkers: 2, payableAmount: 5, status: "closed" });
    await openEscrow(task._id);
    expect(await balance(escrowAccount(String(task._id)))).toBe(0);
    expect(await LedgerTransaction.countDocuments({})).toBe(0);
  });

  it("opens once, even under concurrent attempts, and never for ledger-funded tasks", async () => {
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 3, payableAmount: 10 });
    const results = await Promise.all(Array.from({ length: 6 }, () => openEscrow(task._id)));
    expect(results.filter((r) => r.opened)).toHaveLength(1);
    expect(await balance(escrowAccount(String(task._id)))).toBe(30);

    const rich = await createUser(100);
    const funded = await createFundedTask({
      buyerId: String(rich._id),
      buyerName: "B",
      buyerEmail: "b@example.test",
      data: taskInput({ requiredWorkers: 2, payableAmount: 10 }),
    });
    if (!funded.ok) throw new Error("setup failed");
    expect((await openEscrow(funded.task._id)).opened).toBe(false);
    expect(await balance(escrowAccount(String(funded.task._id)))).toBe(20);
  });

  it("refuses to open a task holding a fractional value", async () => {
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 3, payableAmount: 2.5 });
    await expect(openEscrow(task._id)).rejects.toBeInstanceOf(InvalidTransactionError);
    expect(await LedgerAccount.countDocuments({})).toBe(0);
  });
});

describe("openAll", () => {
  async function seedPreLedger() {
    const buyer = await createUser(40);
    const worker = await createUser(15);
    await createUser(0);
    const open1 = await createPreLedgerTask(buyer._id, { requiredWorkers: 4, payableAmount: 10 }); // 40
    await createPendingSubmission(open1, worker._id); // still 40
    await createPreLedgerTask(buyer._id, { requiredWorkers: 2, filledWorkers: 2, payableAmount: 5, status: "closed" }); // 0
    await createPreLedgerTask(buyer._id, { status: "archived" }); // skipped: nothing pending
    const archivedPending = await createPreLedgerTask(buyer._id, { requiredWorkers: 3, payableAmount: 8 });
    await createPendingSubmission(archivedPending, worker._id);
    await Task.updateOne({ _id: archivedPending._id }, { status: "archived" }); // opens with 8
    return { buyer, worker };
  }

  it("a dry run counts and sums but writes nothing", async () => {
    await seedPreLedger();
    const report = await openAll({ dryRun: true });
    expect(report).toMatchObject({
      dryRun: true,
      truncated: false,
      users: { count: 3, coins: 55, failed: [] },
      tasks: { count: 3, value: 48, archivedAssumedRefunded: 1, skippedArchived: 1, failed: [] },
    });
    expect(await LedgerAccount.countDocuments({})).toBe(0);
    expect(await LedgerTransaction.countDocuments({})).toBe(0);
    expect(await User.countDocuments({ ledgerOpenedAt: { $exists: true } })).toBe(0);
  });

  it("applies, then a second run changes nothing", async () => {
    await seedPreLedger();
    const first = await openAll({ dryRun: false });
    expect(first.users.count).toBe(3);
    expect(first.users.coins).toBe(55);
    expect(first.tasks).toMatchObject({ count: 3, value: 48, archivedAssumedRefunded: 1, skippedArchived: 1 });
    expect(await User.countDocuments({ ledgerOpenedAt: { $exists: false } })).toBe(0);
    expect(await balance("system:migration")).toBe(-(55 + 48));

    const accountsBefore = await LedgerAccount.find({}).lean();
    const rowsBefore = await LedgerTransaction.countDocuments({});
    const second = await openAll({ dryRun: false });
    expect(second.users.count).toBe(0);
    expect(second.tasks.count).toBe(0);
    expect(second.tasks.value).toBe(0);
    expect(await LedgerTransaction.countDocuments({})).toBe(rowsBefore);
    expect(await LedgerAccount.find({}).lean()).toEqual(accountsBefore);
    // The dry run after applying reports nothing left to open either.
    const dry = await openAll({ dryRun: true });
    expect(dry.users.count).toBe(0);
    expect(dry.tasks.count).toBe(0);
  });

  it("reports accounts it cannot open instead of guessing", async () => {
    await createUser(2.5);
    const buyer = await createUser(0);
    await createPreLedgerTask(buyer._id, { requiredWorkers: 3, payableAmount: 2.5 });
    const dry = await openAll({ dryRun: true });
    expect(dry.users.failed).toHaveLength(1);
    expect(dry.tasks.failed).toHaveLength(1);
    const applied = await openAll({ dryRun: false });
    expect(applied.users.failed).toHaveLength(1);
    expect(applied.tasks.failed).toHaveLength(1);
    expect(applied.users.count).toBe(1); // the zero-coin user
  });

  it("stops at the limit and continues on the next run", async () => {
    await seedPreLedger();
    const first = await openAll({ dryRun: false, limit: 2 });
    expect(first.truncated).toBe(true);
    expect(first.users.count).toBe(2);
    const rest = await openAll({ dryRun: false });
    expect(rest.truncated).toBe(false);
    expect(first.users.count + rest.users.count).toBe(3);
    expect(rest.tasks.count).toBe(3);
  });
});
