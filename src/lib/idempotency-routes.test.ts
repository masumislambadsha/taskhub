import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import IdempotencyKey from "@/models/IdempotencyKey";
import Task from "@/models/Task";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import { coinsOf, createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST as withdrawalsRoute } from "@/app/api/v1/withdrawals/route";
import { POST as tasksRoute } from "@/app/api/v1/tasks/route";

const withdrawalsPost = (r: NextRequest) => withdrawalsRoute(r, undefined);
const tasksPost = (r: NextRequest) => tasksRoute(r, undefined);

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_idempotency_routes_test");
  await IdempotencyKey.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await IdempotencyKey.deleteMany({});
  vi.clearAllMocks();
});

const as = (u: { _id: unknown; name?: string; email?: string }, role: string) =>
  authMock.mockResolvedValue({
    user: { id: String(u._id), role, name: u.name, email: u.email },
  });

const post = (path: string, body: unknown, key?: string) =>
  new NextRequest(`https://app.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });

const KEY = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const withdrawalBody = { coinRequested: 200, paymentSystem: "bkash", accountNumber: "01700000000" };

describe("POST /withdrawals with an Idempotency-Key", () => {
  it("creates one withdrawal when the same request is sent five times at once", async () => {
    const worker = await User.create({ name: "W", email: "w@example.test", role: "worker", coins: 500 });
    as(worker, "worker");

    const results = await Promise.all(
      Array.from({ length: 5 }, () => withdrawalsPost(post("/api/v1/withdrawals", withdrawalBody, KEY))),
    );

    expect(await Withdrawal.countDocuments({ workerId: worker._id })).toBe(1);
    expect(results.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
  });

  it("replays the same withdrawal on a later retry", async () => {
    const worker = await User.create({ name: "W", email: "w@example.test", role: "worker", coins: 500 });
    as(worker, "worker");

    const first = await withdrawalsPost(post("/api/v1/withdrawals", withdrawalBody, KEY));
    const retry = await withdrawalsPost(post("/api/v1/withdrawals", withdrawalBody, KEY));

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotent-Replay")).toBe("true");
    expect((await retry.json())._id).toBe((await first.json())._id);
    expect(await Withdrawal.countDocuments()).toBe(1);
  });

  it("returns 422 when the same key is reused with a different amount", async () => {
    const worker = await User.create({ name: "W", email: "w@example.test", role: "worker", coins: 500 });
    as(worker, "worker");

    await withdrawalsPost(post("/api/v1/withdrawals", withdrawalBody, KEY));
    const res = await withdrawalsPost(
      post("/api/v1/withdrawals", { ...withdrawalBody, coinRequested: 400 }, KEY),
    );
    expect(res.status).toBe(422);
    expect(await Withdrawal.countDocuments()).toBe(1);
  });

  it("still works without a key, as before", async () => {
    const worker = await User.create({ name: "W", email: "w@example.test", role: "worker", coins: 500 });
    as(worker, "worker");
    const res = await withdrawalsPost(post("/api/v1/withdrawals", withdrawalBody));
    expect(res.status).toBe(201);
  });
});

describe("POST /tasks with an Idempotency-Key", () => {
  it("charges the buyer once when the same task is posted three times at once", async () => {
    const buyer = await createUser(100);
    as(buyer, "buyer");
    const input = taskInput({ requiredWorkers: 2, payableAmount: 10 }); // costs 20

    const results = await Promise.all(
      Array.from({ length: 3 }, () => tasksPost(post("/api/v1/tasks", input, KEY))),
    );

    expect(await Task.countDocuments({ buyerId: buyer._id })).toBe(1);
    expect(await coinsOf(buyer._id)).toBe(80);
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
  });

  it("does not remember a failed attempt, so a retry after topping up works", async () => {
    const buyer = await createUser(5);
    as(buyer, "buyer");
    const input = taskInput({ requiredWorkers: 2, payableAmount: 10 });

    const poor = await tasksPost(post("/api/v1/tasks", input, KEY));
    expect(poor.status).toBe(400);

    await User.updateOne({ _id: buyer._id }, { $set: { coins: 100 } });
    const again = await tasksPost(post("/api/v1/tasks", input, KEY));
    expect(again.status).toBe(201);
  });
});
