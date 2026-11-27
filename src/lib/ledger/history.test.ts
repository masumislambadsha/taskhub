import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerTransaction from "@/models/LedgerTransaction";
import Withdrawal from "@/models/Withdrawal";
import {
  createPayment,
  createPendingSubmission,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { creditPayment } from "@/lib/payments/credit";
import { InvalidCursorError, getWalletHistory } from "@/lib/ledger/history";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission } from "@/lib/ledger/flows/submissions";
import { approveWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { adjustUserCoins } from "@/lib/ledger/flows/users";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_history_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

describe("getWalletHistory", () => {
  it("returns only the user's own entries, newest first, with their own amount", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    const pay = await createPayment(buyer._id, { coins: 500, price: 20 });
    await creditPayment({ paymentId: String(pay._id), gateway: { name: "sslcommerz", transactionId: "H1", validationId: "HV1" } });
    const t = await createFundedTask({
      buyerId: String(buyer._id), buyerName: "B", buyerEmail: "b@example.test",
      data: taskInput({ requiredWorkers: 2, payableAmount: 25 }),
    });
    if (!t.ok) throw new Error("setup failed");
    const sub = await createPendingSubmission(t.task, worker._id);
    await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });

    const buyerPage = await getWalletHistory(String(buyer._id));
    expect(buyerPage.nextCursor).toBeNull();
    expect(buyerPage.items.map((i) => [i.type, i.amount])).toEqual([
      ["task_fund", -50],
      ["topup", 500],
    ]);
    expect(buyerPage.items[0].taskId).toBe(String(t.task._id));
    expect(buyerPage.items[1].paymentId).toBe(String(pay._id));

    const workerPage = await getWalletHistory(String(worker._id));
    expect(workerPage.items).toHaveLength(1);
    expect(workerPage.items[0]).toMatchObject({
      type: "submission_payout",
      amount: 25,
      taskId: String(t.task._id),
      submissionId: String(sub._id),
    });
    // Nothing from another user's activity leaks into this list.
    const stranger = await createUser(0);
    expect((await getWalletHistory(String(stranger._id))).items).toEqual([]);
  });

  it("hides opening entries but shows everything after them", async () => {
    const worker = await createUser(300);
    const w = await Withdrawal.create({
      workerId: worker._id, workerName: "W", workerEmail: "w@example.test",
      coinRequested: 200, amount: 10, paymentSystem: "bkash", accountNumber: "017",
    });
    await approveWithdrawal({ withdrawalId: String(w._id), adminId: "adm" });
    expect(await LedgerTransaction.countDocuments({ type: "opening" })).toBe(1);
    const page = await getWalletHistory(String(worker._id));
    expect(page.items.map((i) => [i.type, i.amount])).toEqual([["withdrawal_request", -200]]);
    expect(page.items[0].withdrawalId).toBe(String(w._id));
  });

  it("paginates with a cursor without skipping or repeating entries", async () => {
    const user = await createUser(0);
    for (let i = 1; i <= 7; i++) {
      await adjustUserCoins({ userId: String(user._id), delta: i, adminId: "adm", requestId: `p${i}` });
    }
    const seen: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await getWalletHistory(String(user._id), { limit: 3, cursor });
      seen.push(...page.items.map((i) => i.amount));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it("paginates correctly through entries with the same timestamp", async () => {
    const user = await createUser(0);
    const when = new Date("2026-01-01T00:00:00.000Z");
    const rows = Array.from({ length: 5 }, (_, i) => ({
      type: "admin_adjustment" as const,
      idempotencyKey: `same-ts-${i}`,
      entries: [
        { accountId: "system:adjustments", amount: -(i + 1) },
        { accountId: `user:${user._id}`, amount: i + 1 },
      ],
      createdBy: "adm",
      createdAt: when,
    }));
    await LedgerTransaction.collection.insertMany(rows.map((r) => ({ ...r, meta: {} })));
    const seen: number[] = [];
    let cursor: string | null = null;
    do {
      const page = await getWalletHistory(String(user._id), { limit: 2, cursor });
      seen.push(...page.items.map((i) => i.amount));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("caps the page size and rejects a bad cursor", async () => {
    const user = await createUser(0);
    await LedgerTransaction.collection.insertMany(
      Array.from({ length: 55 }, (_, i) => ({
        type: "admin_adjustment",
        idempotencyKey: `cap-${i}`,
        entries: [
          { accountId: "system:adjustments", amount: -1 },
          { accountId: `user:${user._id}`, amount: 1 },
        ],
        meta: {},
        createdBy: "adm",
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      })),
    );
    const big = await getWalletHistory(String(user._id), { limit: 100000 });
    expect(big.items).toHaveLength(50);
    expect(big.nextCursor).not.toBeNull();
    expect((await getWalletHistory(String(user._id), { limit: 0 })).items).toHaveLength(1);
    await expect(getWalletHistory(String(user._id), { cursor: "garbage" })).rejects.toBeInstanceOf(InvalidCursorError);
    await expect(
      getWalletHistory(String(user._id), { cursor: Buffer.from(`1_${new mongoose.Types.ObjectId()}x`).toString("base64url") }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });
});
