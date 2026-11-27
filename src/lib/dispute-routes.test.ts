import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import {
  createPendingSubmission,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { createFundedTask } from "@/lib/ledger/flows/tasks";

const authMock = vi.hoisted(() => vi.fn());
const queueMock = vi.hoisted(() => ({
  scheduleDisputeWindow: vi.fn(async () => true),
  cancelDisputeWindow: vi.fn(async () => undefined),
  scheduleAutoApprove: vi.fn(async () => true),
  cancelAutoApprove: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/queue/auto-approve-queue", () => queueMock);

import { PATCH as statusPatch } from "@/app/api/v1/submissions/[id]/status/route";
import { POST as acceptPost } from "@/app/api/v1/submissions/[id]/accept-rejection/route";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_dispute_routes_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  vi.clearAllMocks();
  process.env.DISPUTE_WINDOW_MS = String(3 * 24 * 3600 * 1000);
});
afterEach(() => {
  process.env.DISPUTE_WINDOW_MS = "0";
});

const as = (u: { _id: unknown } | null, role: string) =>
  authMock.mockResolvedValue(u ? { user: { id: String(u._id), role, name: "N", email: "n@example.test" } } : null);
const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const rejectReq = (id: unknown) =>
  statusPatch(
    new NextRequest(`https://app.test/api/v1/submissions/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reject", reason: "Not what I asked for" }),
    }),
    ctx(id),
  );
const acceptReq = (id: unknown) =>
  acceptPost(new NextRequest(`https://app.test/api/v1/submissions/${id}/accept-rejection`, { method: "POST" }), ctx(id));

async function rejectedSubmission() {
  const buyer = await createUser(100);
  const created = await createFundedTask({
    buyerId: String(buyer._id), buyerName: "B", buyerEmail: buyer.email,
    data: taskInput({ requiredWorkers: 3, payableAmount: 10 }),
  });
  if (!created.ok) throw new Error("setup");
  const worker = await createUser(0);
  const sub = await createPendingSubmission(created.task, worker._id);
  as(buyer, "buyer");
  const res = await rejectReq(sub._id);
  expect(res.status).toBe(200);
  return { buyer, worker, task: created.task, sub };
}

describe("rejecting through the route", () => {
  it("holds the reward, schedules the end of the window, and tells the worker how it ends", async () => {
    const { sub, task } = await rejectedSubmission();
    const s = await Submission.findById(sub._id);
    expect(s?.status).toBe("rejected");
    expect(s?.rejectionHold?.settledAt).toBeUndefined();
    expect(queueMock.cancelAutoApprove).toHaveBeenCalledWith(String(sub._id));
    expect(queueMock.scheduleDisputeWindow).toHaveBeenCalledTimes(1);
    const [id, runAt] = queueMock.scheduleDisputeWindow.mock.calls[0] as unknown as [string, Date];
    expect(id).toBe(String(sub._id));
    expect(runAt.getTime()).toBe(s!.rejectionHold!.windowEndsAt.getTime());
    expect((await Task.findById(task._id))?.filledWorkers).toBe(1);
  });

  it("with a zero window it settles at once and schedules nothing", async () => {
    process.env.DISPUTE_WINDOW_MS = "0";
    const { task } = await rejectedSubmission();
    expect(queueMock.scheduleDisputeWindow).not.toHaveBeenCalled();
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
  });
});

describe("POST /submissions/[id]/accept-rejection", () => {
  it("lets the worker accept: the slot reopens now and the window job is cancelled", async () => {
    const { worker, sub, task } = await rejectedSubmission();
    as(worker, "worker");
    const res = await acceptReq(sub._id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: "reopened" });
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
    expect((await Submission.findById(sub._id))?.rejectionHold?.settledAs).toBe("accepted");
    expect(queueMock.cancelDisputeWindow).toHaveBeenCalledWith(String(sub._id));
  });

  it("a second accept, and simultaneous ones, settle once", async () => {
    const { worker, sub, task } = await rejectedSubmission();
    as(worker, "worker");
    const results = await Promise.all(Array.from({ length: 5 }, () => acceptReq(sub._id)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 404)).toHaveLength(4);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
  });

  it("is only for the submission's own worker", async () => {
    const { sub, buyer } = await rejectedSubmission();
    const other = await createUser(0);
    as(other, "worker");
    expect((await acceptReq(sub._id)).status).toBe(404);
    as(buyer, "buyer");
    expect((await acceptReq(sub._id)).status).toBe(401);
    as({ _id: "6b0000000000000000000a01" }, "demo_admin");
    expect((await acceptReq(sub._id)).status).toBe(403);
    as(null, "worker");
    expect((await acceptReq(sub._id)).status).toBe(401);
    expect((await Submission.findById(sub._id))?.rejectionHold?.settledAt).toBeUndefined();
  });

  it("refuses a malformed ID and a submission that was not rejected", async () => {
    const { worker, buyer, task } = await rejectedSubmission();
    as(worker, "worker");
    expect((await acceptReq("nope")).status).toBe(404);
    const pending = await createPendingSubmission(task, worker._id);
    expect((await acceptReq(pending._id)).status).toBe(404);
    void buyer;
  });
});
