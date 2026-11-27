// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import Task from "@/models/Task";
import User from "@/models/User";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { requestWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { WITHDRAWAL_DAILY_LIMIT_COINS } from "@/lib/constants";
import { createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/queue/auto-approve-queue", () => ({
  scheduleAutoApprove: vi.fn(async () => true),
  scheduleProofHash: vi.fn(async () => true),
  scheduleDisputeWindow: vi.fn(async () => true),
  cancelDisputeWindow: vi.fn(async () => undefined),
  cancelAutoApprove: vi.fn(async () => undefined),
}));

import { POST as submitPost } from "@/app/api/v1/submissions/route";

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb("taskhub_trust_gates_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  vi.clearAllMocks();
});

async function setup(minLevel: number) {
  const buyer = await createUser(1000);
  const worker = await createUser(0);
  await User.updateOne({ _id: worker._id }, { $set: { role: "worker" } });
  const res = await createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "B",
    buyerEmail: "b@example.test",
    data: { ...taskInput({ requiredWorkers: 3, payableAmount: 5 }), minLevel },
  });
  if (!res.ok) throw new Error("setup failed");
  authMock.mockResolvedValue({ user: { id: String(worker._id), role: "worker", name: "W", email: worker.email } });
  return { worker, taskId: String(res.task._id) };
}
const submit = (taskId: string) =>
  submitPost(
    new NextRequest("https://app.test/api/v1/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, details: "I did the thing, here is how it went.", proofLinks: ["https://example.com/proof"] }),
    }),
    undefined as never,
  );

describe("task level gate", () => {
  it("the task stores its minimum level", async () => {
    const { taskId } = await setup(2);
    expect((await Task.findById(taskId).lean())?.minLevel).toBe(2);
  });

  it("a worker below the level is refused on the server, and the slot is not used", async () => {
    const { taskId } = await setup(2);
    const res = await submit(taskId);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("LEVEL_TOO_LOW");
    expect(body.error).toMatch(/Skilled.*Your level is New/);
    expect((await Task.findById(taskId).lean())?.filledWorkers).toBe(0);
  });

  it("a worker at or above the level can submit", async () => {
    const { worker, taskId } = await setup(2);
    await User.updateOne({ _id: worker._id }, { $set: { trust: { score: 65, level: 2, components: {}, capped: false, computedAt: new Date() } } });
    expect((await submit(taskId)).status).toBe(201);
  });

  it("a task with no minimum level is open to everyone", async () => {
    const { taskId } = await setup(0);
    expect((await submit(taskId)).status).toBe(201);
  });
});

describe("withdrawal limits by level", () => {
  it("a Trusted worker may withdraw 4 times the base daily limit, a New one only the base", async () => {
    const newcomer = await createUser(100_000);
    const trusted = await createUser(100_000);
    await User.updateOne({ _id: trusted._id }, { $set: { trust: { score: 90, level: 3, components: {}, capped: false, computedAt: new Date() } } });
    const ask = (u: { _id: unknown; email: string }, coins: number, n: string) =>
      requestWithdrawal({ worker: { id: String(u._id), name: "W", email: u.email }, coins, paymentSystem: "bkash", accountNumber: n });

    expect((await ask(newcomer, WITHDRAWAL_DAILY_LIMIT_COINS + 100, "01711111111")).ok).toBe(false);
    expect((await ask(trusted, WITHDRAWAL_DAILY_LIMIT_COINS * 3, "01722222222")).ok).toBe(true);
    const over = await ask(trusted, WITHDRAWAL_DAILY_LIMIT_COINS * 2, "01722222222");
    expect(over).toEqual({ ok: false, reason: "daily_limit" });
  });
});
