import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Task from "@/models/Task";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import {
  createPendingSubmission,
  createPreLedgerTask,
  startTestDb,
} from "@/lib/payments/test-utils";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET as leaderboardGet } from "@/app/api/v1/leaderboard/route";
import { GET as tasksGet } from "@/app/api/v1/tasks/route";
import { GET as taskGet } from "@/app/api/v1/tasks/[id]/route";
import { GET as withdrawalsGet } from "@/app/api/v1/withdrawals/route";
import { GET as submissionsGet } from "@/app/api/v1/submissions/route";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_privacy_routes_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  vi.clearAllMocks();
});

const as = (u: { _id: unknown; role: string } | null) =>
  authMock.mockResolvedValue(u ? { user: { id: String(u._id), role: u.role } } : null);
const req = (path: string) => new NextRequest(`https://app.test${path}`);
const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const mk = (role: string, email: string) =>
  User.create({ name: email.split("@")[0], email, role });

async function world() {
  const admin = await mk("admin", "owner@example.test");
  const demo = await mk("demo_admin", "demo@example.test");
  const worker = await mk("worker", "worker.one@example.test");
  const worker2 = await mk("worker", "worker.two@example.test");
  const buyer = await mk("buyer", "buyer.one@example.test");
  const buyer2 = await mk("buyer", "buyer.two@example.test");
  const task = await createPreLedgerTask(buyer._id);
  await Task.updateOne({ _id: task._id }, { buyerEmail: "buyer.one@example.test" });
  return { admin, demo, worker, worker2, buyer, buyer2, task };
}

const withdrawal = (w: { _id: unknown }, email: string, account: string) =>
  Withdrawal.create({
    workerId: w._id as mongoose.Types.ObjectId,
    workerName: "W",
    workerEmail: email,
    coinRequested: 200,
    amount: 10,
    paymentSystem: "bkash",
    accountNumber: account,
  });

describe("GET /leaderboard", () => {
  it("returns no email, and nothing else private, to an anonymous caller", async () => {
    await world();
    as(null);
    const res = await leaderboardGet();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.length).toBe(2);
    for (const row of data) {
      expect(Object.keys(row).sort()).toEqual(["_id", "approvalRate", "coinsEarned", "name", "rank"]);
    }
    expect(JSON.stringify(data)).not.toContain("@");
  });
});

describe("GET /tasks and /tasks/[id]", () => {
  it("leave buyerEmail out for anonymous callers, workers and other buyers", async () => {
    const { worker, buyer2, task } = await world();
    for (const who of [null, worker, buyer2]) {
      as(who);
      const list = await (await tasksGet(req("/api/v1/tasks"))).json();
      expect(list.tasks.length).toBe(1);
      expect("buyerEmail" in list.tasks[0]).toBe(false);
      expect(JSON.stringify(list)).not.toContain("buyer.one@example.test");
      const one = await (await taskGet(req("/x"), ctx(task._id))).json();
      expect(one.title).toBe(task.title);
      expect("buyerEmail" in one).toBe(false);
    }
  });

  it("show it to the owning buyer and to an admin, masked to a demo admin", async () => {
    const { buyer, admin, demo, task } = await world();
    for (const who of [buyer, admin]) {
      as(who);
      expect((await (await taskGet(req("/x"), ctx(task._id))).json()).buyerEmail).toBe("buyer.one@example.test");
    }
    as(buyer);
    const own = await (await tasksGet(req("/api/v1/tasks?buyerOnly=1"))).json();
    expect(own.tasks[0].buyerEmail).toBe("buyer.one@example.test");
    as(demo);
    expect((await (await taskGet(req("/x"), ctx(task._id))).json()).buyerEmail).toBe("b•••@example.test");
    expect((await (await tasksGet(req("/api/v1/tasks"))).json()).tasks[0].buyerEmail).toBe("b•••@example.test");
  });

  it("detail returns 404 for a task that does not exist or a bad id", async () => {
    await world();
    as(null);
    expect((await taskGet(req("/x"), ctx(new mongoose.Types.ObjectId()))).status).toBe(404);
    expect((await taskGet(req("/x"), ctx("nope"))).status).toBe(404);
  });
});

describe("GET /withdrawals", () => {
  it("refuses a buyer with 403 and an anonymous caller with 401", async () => {
    const { buyer, worker } = await world();
    await withdrawal(worker, "worker.one@example.test", "01929686694");
    as(buyer);
    const res = await withdrawalsGet(req("/api/v1/withdrawals"));
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("01929686694");
    as(null);
    expect((await withdrawalsGet(req("/api/v1/withdrawals"))).status).toBe(401);
  });

  it("gives a worker only their own", async () => {
    const { worker, worker2 } = await world();
    await withdrawal(worker, "worker.one@example.test", "01929686694");
    await withdrawal(worker2, "worker.two@example.test", "01811111111");
    as(worker);
    const body = await (await withdrawalsGet(req("/api/v1/withdrawals"))).json();
    expect(body.total).toBe(1);
    expect(body.withdrawals[0].workerEmail).toBe("worker.one@example.test");
    expect(body.withdrawals[0].accountNumber).toBe("01929686694");
  });

  it("masks the email and account for a demo admin, and shows an admin the real values", async () => {
    const { demo, admin, worker, worker2 } = await world();
    await withdrawal(worker, "worker.one@example.test", "01929686694");
    await withdrawal(worker2, "worker.two@example.test", "01811111111");
    as(demo);
    const masked = await (await withdrawalsGet(req("/api/v1/withdrawals"))).json();
    expect(masked.total).toBe(2);
    expect(masked.withdrawals.map((w: { accountNumber: string }) => w.accountNumber).sort()).toEqual([
      "018•••••111",
      "019•••••694",
    ]);
    for (const w of masked.withdrawals) expect(w.workerEmail).toMatch(/^w•••@example\.test$/);
    as(admin);
    const real = await (await withdrawalsGet(req("/api/v1/withdrawals"))).json();
    expect(real.withdrawals.map((w: { accountNumber: string }) => w.accountNumber).sort()).toEqual([
      "01811111111",
      "01929686694",
    ]);
    expect(real.withdrawals[0].workerEmail).toContain("worker.");
  });
});

describe("GET /submissions", () => {
  it("leaves the worker's email out for the buyer, shows the worker their own, masks it for a demo admin", async () => {
    const { buyer, worker, admin, demo, task } = await world();
    await createPendingSubmission(task, worker._id);
    as(buyer);
    const forBuyer = await (await submissionsGet(req("/api/v1/submissions"))).json();
    expect(forBuyer.submissions.length).toBe(1);
    expect("workerEmail" in forBuyer.submissions[0]).toBe(false);
    as(worker);
    const own = await (await submissionsGet(req("/api/v1/submissions"))).json();
    expect(own.submissions[0].workerEmail).toBe("worker@example.test");
    as(admin);
    expect((await (await submissionsGet(req("/api/v1/submissions"))).json()).submissions[0].workerEmail).toBe(
      "worker@example.test",
    );
    as(demo);
    expect((await (await submissionsGet(req("/api/v1/submissions"))).json()).submissions[0].workerEmail).toBe(
      "w•••@example.test",
    );
  });
});
