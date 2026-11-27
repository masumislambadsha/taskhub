import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Redis from "ioredis";
import AuditLog from "@/models/AuditLog";
import Submission from "@/models/Submission";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import { createPendingSubmission, createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { LIMITS } from "@/lib/rate-limit-config";
import { logger } from "@/lib/logger";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/email", () => ({ sendWithdrawalConfirmationEmail: vi.fn(async () => undefined) }));
vi.mock("@/lib/queue/auto-approve-queue", () => ({
  scheduleAutoApprove: vi.fn(async () => true),
  cancelAutoApprove: vi.fn(async () => undefined),
  scheduleDisputeWindow: vi.fn(async () => true),
  cancelDisputeWindow: vi.fn(async () => undefined),
}));

import {
  clientIp,
  closeRateLimiter,
  consume,
  consumeAi,
  consumeApiKey,
  rateLimitedResponse,
  resetLimit,
  resetMemoryLimits,
} from "@/lib/ratelimit";
import { LoginRateLimited, authorizeCredentials } from "@/lib/credentials-login";
import { POST as registerPost } from "@/app/api/v1/auth/register/route";
import { POST as submissionsPost } from "@/app/api/v1/submissions/route";
import { POST as withdrawalsPost } from "@/app/api/v1/withdrawals/route";

// A real Redis, as in production. Set TEST_REDIS_URL (CI does); without it the shared-state tests are skipped.
const BASE = process.env.TEST_REDIS_URL;
const URL = BASE ? `${BASE}/3` : undefined;
const withRedis = describe.skipIf(!URL);

let db: Awaited<ReturnType<typeof startTestDb>>;
let admin: Redis | undefined;

beforeAll(async () => {
  db = await startTestDb("taskhub_ratelimit_test");
  if (URL) admin = new Redis(URL);
}, 180_000);
afterAll(async () => {
  await db?.stop();
  admin?.disconnect();
});
beforeEach(async () => {
  await db.reset();
  await Withdrawal.deleteMany({});
  resetMemoryLimits();
  if (admin) await admin.flushdb();
});
afterEach(async () => {
  await closeRateLimiter();
  delete process.env.REDIS_URL;
  delete process.env.VERCEL;
});

const useRedis = (url = URL) => {
  process.env.REDIS_URL = url;
};

describe("limits table", () => {
  it("has the limits the roadmap names", () => {
    expect(LIMITS.login_account).toMatchObject({ points: 5, windowSec: 900 });
    expect(LIMITS.login_ip).toMatchObject({ points: 30, windowSec: 900 });
    expect(LIMITS.signup).toMatchObject({ points: 5, windowSec: 3600 });
    expect(LIMITS.mfa).toMatchObject({ points: 5, windowSec: 900 });
    expect(LIMITS.submit).toMatchObject({ points: 30, windowSec: 3600 });
    expect(LIMITS.withdraw).toMatchObject({ points: 3, windowSec: 86400 });
    expect(LIMITS.chat).toMatchObject({ points: 20, windowSec: 10 });
    expect(LIMITS.ai).toMatchObject({ points: 20, windowSec: 86400 });
  });

  it("fails closed for login, signup, two-factor, withdrawals and AI, and open for chat, submissions and uploads", () => {
    for (const closed of ["login_account", "login_ip", "signup", "mfa", "withdraw", "ai"] as const) {
      expect(LIMITS[closed].failMode).toBe("closed");
    }
    for (const open of ["chat", "submit", "upload", "withdraw_resend"] as const) {
      expect(LIMITS[open].failMode).toBe("open");
    }
  });
});

describe("without Redis configured", () => {
  it("counts in memory, so local development still has limits", async () => {
    for (let i = 0; i < 5; i++) expect((await consume("login_account", "a@example.test")).ok).toBe(true);
    const blocked = await consume("login_account", "a@example.test");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await consume("login_account", "other@example.test")).ok).toBe(true);
  });
});

withRedis("shared through Redis", () => {
  it("allows up to the limit, then blocks with the time left, and counts keys separately", async () => {
    useRedis();
    for (let i = 0; i < 5; i++) {
      const r = await consume("login_account", "a@example.test");
      expect(r).toMatchObject({ ok: true, remaining: 4 - i });
    }
    const blocked = await consume("login_account", "a@example.test");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(890);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(900);
    expect((await consume("login_account", "b@example.test")).ok).toBe(true);
    expect((await consume("login_ip", "a@example.test")).ok).toBe(true); // another limit, another counter
  });

  it("opens a new window when the old one runs out", async () => {
    useRedis();
    for (let i = 0; i < 20; i++) await consume("chat", "u1");
    expect((await consume("chat", "u1")).ok).toBe(false);
    await admin!.expire("rl:chat:u1", 1);
    await new Promise((r) => setTimeout(r, 1200));
    expect((await consume("chat", "u1")).ok).toBe(true);
  });

  it("the 6th login attempt is refused even when the attempts alternate between two instances", async () => {
    useRedis();
    // Two separate copies of the module, each with its own Redis connection: web1 and web2.
    const web1 = await import("@/lib/ratelimit");
    vi.resetModules();
    const web2 = await import("@/lib/ratelimit");
    expect(web2.consume).not.toBe(web1.consume);

    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const instance = i % 2 === 0 ? web1 : web2;
      results.push((await instance.consume("login_account", "shared@example.test")).ok);
    }
    expect(results).toEqual([true, true, true, true, true, false]);
    await web1.closeRateLimiter();
    await web2.closeRateLimiter();
  });

  it("is atomic: 40 simultaneous attempts let exactly 5 through", async () => {
    useRedis();
    const results = await Promise.all(Array.from({ length: 40 }, () => consume("login_account", "race@example.test")));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });

  it("a key can be cleared", async () => {
    useRedis();
    for (let i = 0; i < 6; i++) await consume("login_account", "c@example.test");
    expect((await consume("login_account", "c@example.test")).ok).toBe(false);
    await resetLimit("login_account", "c@example.test");
    expect((await consume("login_account", "c@example.test")).ok).toBe(true);
  });

  it("limits AI per user and per feature, 20 a day", async () => {
    useRedis();
    for (let i = 0; i < 20; i++) expect((await consumeAi("proof-check", "u1")).ok).toBe(true);
    expect((await consumeAi("proof-check", "u1")).ok).toBe(false);
    expect((await consumeAi("task-writer", "u1")).ok).toBe(true);
    expect((await consumeAi("proof-check", "u2")).ok).toBe(true);
  });

  it("limits the public API per key by plan", async () => {
    useRedis();
    for (let i = 0; i < 60; i++) expect((await consumeApiKey("key1", "free")).ok).toBe(true);
    expect((await consumeApiKey("key1", "free")).ok).toBe(false);
    for (let i = 0; i < 61; i++) expect((await consumeApiKey("key2", "pro")).ok).toBe(true);
    expect((await consumeApiKey("key3", "free")).ok).toBe(true);
  });
});

describe("when Redis is configured but down", () => {
  it("blocks what must never run unchecked (fail closed) and lets chat through (fail open)", async () => {
    useRedis("redis://127.0.0.1:1"); // nothing listens here
    const start = Date.now();
    const login = await consume("login_account", "a@example.test");
    expect(login).toMatchObject({ ok: false, degraded: true });
    expect((await consume("withdraw", "u1")).ok).toBe(false);
    expect((await consume("mfa", "u1")).ok).toBe(false);
    expect((await consumeAi("x", "u1")).ok).toBe(false);

    expect(await consume("chat", "u1")).toMatchObject({ ok: true, degraded: true });
    expect((await consume("submit", "u1")).ok).toBe(true);
    expect((await consume("upload", "u1")).ok).toBe(true);
    expect(Date.now() - start).toBeLessThan(15_000);
  }, 30_000);
});

describe("client IP", () => {
  it("trusts X-Real-IP, which Nginx sets, and ignores a spoofed X-Forwarded-For", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "1.2.3.4" });
    expect(clientIp(h)).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("uses the first X-Forwarded-For only on Vercel, whose edge writes it", () => {
    process.env.VERCEL = "1";
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" }))).toBe("198.51.100.9");
  });
});

describe("the 429 answer", () => {
  it("carries Retry-After and text the page can show as is", async () => {
    const res = rateLimitedResponse(120);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("120");
    expect((await res.json()).error).toBe("Too many requests. Try again in 2 minutes.");
    expect((await rateLimitedResponse(30).json()).error).toContain("30 seconds");
    expect((await rateLimitedResponse(1).json()).error).toContain("1 second.");
    expect((await rateLimitedResponse(60).json()).error).toContain("1 minute.");
  });
});

describe("login", () => {
  async function account(password = "correct horse") {
    return User.create({
      name: "Pat", email: "pat@example.test", role: "worker",
      passwordHash: await bcrypt.hash(password, 4),
    });
  }
  const login = (email: string, password: string, ip = "198.51.100.1") =>
    authorizeCredentials({ email, password }, { headers: new Headers({ "x-real-ip": ip }) });

  it("signs in with the right password and refuses a wrong one, as before", async () => {
    await account();
    expect((await login("pat@example.test", "correct horse"))?.email).toBe("pat@example.test");
    expect(await login("pat@example.test", "wrong")).toBeNull();
    expect(await login("nobody@example.test", "x")).toBeNull();
    expect(await authorizeCredentials({ email: "", password: "" })).toBeNull();
  });

  it("blocks the 6th attempt on an account with the wait in the error, even with the right password", async () => {
    await account();
    for (let i = 0; i < 5; i++) expect(await login("pat@example.test", "wrong", `198.51.100.${i}`)).toBeNull();
    const err = await login("pat@example.test", "correct horse", "198.51.100.77").catch((e) => e);
    expect(err).toBeInstanceOf(LoginRateLimited);
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts attempts on an email that does not exist, so the limit reveals nothing", async () => {
    for (let i = 0; i < 5; i++) expect(await login("ghost@example.test", "x")).toBeNull();
    await expect(login("ghost@example.test", "x")).rejects.toBeInstanceOf(LoginRateLimited);
  });

  it("ignores letter case in the email", async () => {
    for (let i = 0; i < 5; i++) await login(i % 2 ? "GHOST@example.test" : "ghost@example.test", "x");
    await expect(login("Ghost@Example.test", "x")).rejects.toBeInstanceOf(LoginRateLimited);
  });

  it("a correct password clears the account's count", async () => {
    await account();
    for (let i = 0; i < 4; i++) await login("pat@example.test", "wrong", `203.0.113.${i}`);
    expect(await login("pat@example.test", "correct horse", "203.0.113.50")).not.toBeNull();
    // Counting starts again: 5 more wrong tries are allowed before the block.
    for (let i = 0; i < 5; i++) expect(await login("pat@example.test", "wrong", `203.0.113.${60 + i}`)).toBeNull();
    await expect(login("pat@example.test", "wrong", "203.0.113.99")).rejects.toBeInstanceOf(LoginRateLimited);
  });

  it("blocks one IP after 30 attempts across many accounts, but not other IPs", async () => {
    for (let i = 0; i < 30; i++) expect(await login(`user${i}@example.test`, "x", "192.0.2.10")).toBeNull();
    await expect(login("user99@example.test", "x", "192.0.2.10")).rejects.toBeInstanceOf(LoginRateLimited);
    expect(await login("user99@example.test", "x", "192.0.2.11")).toBeNull();
  });

  it("still tells a suspended account apart", async () => {
    const u = await account();
    await User.updateOne({ _id: u._id }, { $set: { status: "suspended" } });
    await expect(login("pat@example.test", "correct horse")).rejects.toThrow("Account suspended");
  });
});

describe("sign-up", () => {
  const signup = (n: number, ip = "198.51.100.1", device?: string) =>
    registerPost(
      new NextRequest("https://app.test/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip, ...(device ? { "x-device-id": device } : {}) },
        body: JSON.stringify({ name: "New User", email: `new${n}@example.test`, password: "Password123", confirmPassword: "Password123", role: "worker" }),
      }),
    );

  it("the 6th sign-up from one IP and device in an hour gets 429 with Retry-After", async () => {
    for (let i = 0; i < 5; i++) expect((await signup(i, "198.51.100.1", "dev-a")).status).toBe(201);
    const blocked = await signup(5, "198.51.100.1", "dev-a");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await User.countDocuments()).toBe(5);
  });

  it("another device on the same carrier IP is not blocked by it", async () => {
    for (let i = 0; i < 5; i++) await signup(i, "198.51.100.1", "dev-a");
    expect((await signup(10, "198.51.100.1", "dev-b")).status).toBe(201);
    expect((await signup(11, "198.51.100.2", "dev-a")).status).toBe(201);
  });
});

describe("task submission, withdrawal and replays", () => {
  async function worker() {
    const u = await User.create({ name: "W", email: `w${Math.random()}@example.test`, role: "worker", coins: 5000 });
    authMock.mockResolvedValue({ user: { id: String(u._id), role: "worker", name: "W", email: u.email } });
    return u;
  }
  const withdraw = (headers: Record<string, string> = {}) =>
    withdrawalsPost(
      new NextRequest("https://app.test/api/v1/withdrawals", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ coinRequested: 200, paymentSystem: "bkash", accountNumber: "01700000000" }),
      }),
      undefined,
    );

  it("the 4th withdrawal request in a day gets 429, and nothing is reserved for it", async () => {
    await worker();
    for (let i = 0; i < 3; i++) expect((await withdraw()).status).toBe(201);
    const blocked = await withdraw();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await Withdrawal.countDocuments()).toBe(3);
  });

  it("repeating the same request with its Idempotency-Key does not use up the day's 3", async () => {
    await worker();
    const key = { "Idempotency-Key": "withdraw-replay-0001" };
    for (let i = 0; i < 6; i++) expect([201, 409]).toContain((await withdraw(key)).status);
    expect(await Withdrawal.countDocuments()).toBe(1);
    // Two more real requests still fit.
    expect((await withdraw()).status).toBe(201);
    expect((await withdraw()).status).toBe(201);
    expect((await withdraw()).status).toBe(429);
  });

  it("the 31st submission in an hour gets 429 and no submission is made", async () => {
    const buyer = await createUser(500);
    const created = await createFundedTask({
      buyerId: String(buyer._id), buyerName: "B", buyerEmail: buyer.email,
      data: taskInput({ requiredWorkers: 3, payableAmount: 10 }),
    });
    if (!created.ok) throw new Error("setup");
    const w = await worker();
    for (let i = 0; i < 30; i++) await consume("submit", String(w._id));

    const res = await submissionsPost(
      new NextRequest("https://app.test/api/v1/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: String(created.task._id), details: "Here is my finished work for the task." }),
      }),
      undefined,
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await Submission.countDocuments()).toBe(0);
    void createPendingSubmission;
  });

  it("blocks are logged, and the log keeps no email address", async () => {
    const spy = vi.spyOn(logger, "warn");
    for (let i = 0; i < 6; i++) await consume("login_account", "private@example.test");
    const hit = spy.mock.calls.find((c) => (c[1] as string) === "rate limit hit");
    expect(hit).toBeDefined();
    expect(JSON.stringify(hit)).not.toContain("private@example.test");
    expect(hit![0]).toMatchObject({ limit: "login_account" });
    spy.mockRestore();
    void AuditLog;
  });
});
