import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import MfaCredential from "@/models/MfaCredential";
import MfaSession from "@/models/MfaSession";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import { createUser, startTestDb } from "@/lib/payments/test-utils";
import { currentStep, totpForStep } from "@/lib/totp";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import {
  FAIL_WINDOW_MS,
  LOCK_MS,
  RECOVERY_CODE_COUNT,
  STEP_UP_WINDOW_MS,
  beginEnrollment,
  confirmEnrollment,
  getMfaState,
  resetMfa,
  verifyMfa,
} from "@/lib/mfa";
import { GET as usersGet } from "@/app/api/v1/admin/users/route";
import { PATCH as withdrawalPatch } from "@/app/api/v1/withdrawals/[id]/approve/route";
import { GET as withdrawalsGet } from "@/app/api/v1/withdrawals/route";
import { GET as paymentsHistory } from "@/app/api/v1/payments/history/route";
import { POST as ledgerOpen } from "@/app/api/v1/admin/ledger/open/route";
import { GET as statusGet } from "@/app/api/v1/admin/mfa/status/route";
import { POST as setupPost } from "@/app/api/v1/admin/mfa/setup/route";
import { POST as enablePost } from "@/app/api/v1/admin/mfa/enable/route";
import { POST as verifyPost } from "@/app/api/v1/admin/mfa/verify/route";
import { POST as resetPost } from "@/app/api/v1/admin/users/[id]/mfa-reset/route";
import { decryptSecret } from "@/lib/mfa-crypto";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  process.env.MFA_ENFORCED = "true";
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  db = await startTestDb("taskhub_mfa_test");
  await Promise.all([MfaCredential.init(), MfaSession.init()]);
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([MfaCredential.deleteMany({}), MfaSession.deleteMany({})]);
  vi.clearAllMocks();
});

const MIN = 60_000;
const SID = "session-1";

async function admin(role = "admin") {
  return User.create({ name: role, email: `${role}-${Math.random()}@example.test`, role });
}

/** Enrolls the user and returns the plain secret and recovery codes. Marks `sid` verified. */
async function enroll(userId: string, sid = SID) {
  const begun = await beginEnrollment(userId, "a@example.test");
  if (!begun.ok) throw new Error("begin failed");
  const done = await confirmEnrollment(userId, sid, totpForStep(begun.manualKey, currentStep()));
  if (!done.ok) throw new Error("confirm failed");
  return { secret: begun.manualKey, recoveryCodes: done.recoveryCodes };
}

/** A valid code that has not been used yet. */
async function freshCode(userId: string, secret: string) {
  await MfaCredential.updateOne({ userId }, { $set: { lastUsedStep: 0 } });
  return totpForStep(secret, currentStep());
}

describe("enrollment", () => {
  it("starts with a QR code and a manual key, and nothing counts until a code is confirmed", async () => {
    const u = await admin();
    const res = await beginEnrollment(String(u._id), "me@example.test");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.manualKey).toMatch(/^[A-Z2-7]{32}$/);
    expect(res.otpauthUri).toContain(`secret=${res.manualKey}`);
    expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(await getMfaState(String(u._id), SID)).toEqual({ enrolled: false, verified: false, stepUpFresh: false });

    const wrong = await confirmEnrollment(String(u._id), SID, "000000");
    expect(wrong.ok === false && wrong.reason).toBe("invalid");
    expect((await getMfaState(String(u._id), SID)).enrolled).toBe(false);
  });

  it("confirming turns it on, verifies this login, and returns ten recovery codes once", async () => {
    const u = await admin();
    const { recoveryCodes } = await enroll(String(u._id));
    expect(recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(recoveryCodes).size).toBe(RECOVERY_CODE_COUNT);
    for (const c of recoveryCodes) expect(c).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(await getMfaState(String(u._id), SID)).toEqual({ enrolled: true, verified: true, stepUpFresh: true });
    expect((await beginEnrollment(String(u._id), "x")).ok).toBe(false);
  });

  it("never stores the secret or the recovery codes in plain text", async () => {
    const u = await admin();
    const { secret, recoveryCodes } = await enroll(String(u._id));
    const raw = JSON.stringify(await mongoose.connection.collection("mfa_credentials").findOne({ userId: String(u._id) }));
    expect(raw).not.toContain(secret);
    for (const c of recoveryCodes) {
      expect(raw).not.toContain(c);
      expect(raw).not.toContain(c.replace("-", ""));
    }
    const cred = await MfaCredential.findOne({ userId: String(u._id) }).lean();
    expect(decryptSecret(cred!.secret!)).toBe(secret);
    expect(cred!.recoveryCodes.every((r) => r.hash.startsWith("$2"))).toBe(true);
  });

  it("two simultaneous confirmations enroll once", async () => {
    const u = await admin();
    const begun = await beginEnrollment(String(u._id), "a");
    if (!begun.ok) throw new Error();
    const code = totpForStep(begun.manualKey, currentStep());
    const results = await Promise.all([1, 2, 3].map(() => confirmEnrollment(String(u._id), SID, code)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("verifying a code", () => {
  it("accepts a fresh code and refuses the same code a second time", async () => {
    const u = await admin();
    const id = String(u._id);
    const { secret } = await enroll(id);
    const code = await freshCode(id, secret);
    expect((await verifyMfa(id, SID, code)).ok).toBe(true);
    const again = await verifyMfa(id, SID, code);
    expect(again).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a code from an earlier step than one already used", async () => {
    const u = await admin();
    const id = String(u._id);
    const { secret } = await enroll(id);
    const now = Date.now();
    await MfaCredential.updateOne({ userId: id }, { $set: { lastUsedStep: 0 } });
    expect((await verifyMfa(id, SID, totpForStep(secret, currentStep(now)), now)).ok).toBe(true);
    expect((await verifyMfa(id, SID, totpForStep(secret, currentStep(now) - 1), now)).ok).toBe(false);
  });

  it("when many requests carry the same code at once, exactly one succeeds", async () => {
    const u = await admin();
    const id = String(u._id);
    const { secret } = await enroll(id);
    const code = await freshCode(id, secret);
    const results = await Promise.all(Array.from({ length: 8 }, () => verifyMfa(id, SID, code)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("refuses wrong, malformed and empty input, and an account with no second factor", async () => {
    const u = await admin();
    const id = String(u._id);
    expect(await verifyMfa(id, SID, "123456")).toEqual({ ok: false, reason: "not_enrolled" });
    const { secret } = await enroll(id);
    const good = totpForStep(secret, currentStep());
    const wrong = good === "123456" ? "654321" : "123456";
    for (const bad of [wrong, "", "abc", "12345", "1234567", "zzzzz-zzzzz"]) {
      const res = await verifyMfa(id, SID, bad);
      expect(res.ok).toBe(false);
    }
  });
});

describe("lockout", () => {
  async function enrolled() {
    const u = await admin();
    const id = String(u._id);
    const { secret } = await enroll(id);
    return { id, secret };
  }

  it("five wrong codes lock it, and even the right code is refused while locked", async () => {
    const { id, secret } = await enrolled();
    const now = Date.now();
    for (let i = 0; i < 4; i++) expect(await verifyMfa(id, SID, "000001", now + i)).toEqual({ ok: false, reason: "invalid" });
    const fifth = await verifyMfa(id, SID, "000001", now + 5);
    expect(fifth).toMatchObject({ ok: false, reason: "locked", retryAfterSeconds: LOCK_MS / 1000 });

    await MfaCredential.updateOne({ userId: id }, { $set: { lastUsedStep: 0 } });
    const right = totpForStep(secret, currentStep(now + MIN));
    expect(await verifyMfa(id, SID, right, now + MIN)).toMatchObject({ ok: false, reason: "locked" });
    // After the lock ends the right code works again.
    const later = now + LOCK_MS + MIN;
    expect((await verifyMfa(id, SID, totpForStep(secret, currentStep(later)), later)).ok).toBe(true);
  });

  it("wrong codes spread over more than the window do not add up", async () => {
    const { id } = await enrolled();
    const now = Date.now();
    for (let i = 0; i < 4; i++) await verifyMfa(id, SID, "000001", now + i);
    // 16 minutes later the old failures no longer count.
    expect(await verifyMfa(id, SID, "000001", now + FAIL_WINDOW_MS + MIN)).toEqual({ ok: false, reason: "invalid" });
    expect((await MfaCredential.findOne({ userId: id }))?.failedAttempts).toBe(1);
  });

  it("a correct code clears the failure count", async () => {
    const { id, secret } = await enrolled();
    for (let i = 0; i < 3; i++) await verifyMfa(id, SID, "000001");
    expect((await verifyMfa(id, SID, await freshCode(id, secret))).ok).toBe(true);
    expect((await MfaCredential.findOne({ userId: id }))?.failedAttempts).toBe(0);
  });
});

describe("recovery codes", () => {
  it("each of the ten works exactly once", async () => {
    const u = await admin();
    const id = String(u._id);
    const { recoveryCodes } = await enroll(id);
    for (const [i, code] of recoveryCodes.entries()) {
      const first = await verifyMfa(id, SID, code);
      expect(first).toMatchObject({ ok: true, usedRecoveryCode: true, recoveryCodesLeft: RECOVERY_CODE_COUNT - i - 1 });
      expect((await verifyMfa(id, SID, code)).ok).toBe(false);
    }
  });

  it("accepts the code without the dash and in capitals, and counts a spent code as a wrong one", async () => {
    const u = await admin();
    const id = String(u._id);
    const { recoveryCodes } = await enroll(id);
    expect((await verifyMfa(id, SID, recoveryCodes[0].replace("-", "").toUpperCase())).ok).toBe(true);
    expect((await verifyMfa(id, SID, recoveryCodes[0])).ok).toBe(false);
    expect((await MfaCredential.findOne({ userId: id }))?.failedAttempts).toBe(1);
  });

  it("the same recovery code sent many times at once is spent once", async () => {
    const u = await admin();
    const id = String(u._id);
    const { recoveryCodes } = await enroll(id);
    const results = await Promise.all(Array.from({ length: 6 }, () => verifyMfa(id, SID, recoveryCodes[3])));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("session state", () => {
  it("is tracked per login, so another login of the same admin is not verified", async () => {
    const u = await admin();
    const id = String(u._id);
    await enroll(id, "login-A");
    expect((await getMfaState(id, "login-A")).verified).toBe(true);
    expect((await getMfaState(id, "login-B")).verified).toBe(false);
    expect((await getMfaState(id, undefined)).verified).toBe(false);
  });

  it("the step-up lasts 15 minutes", async () => {
    const u = await admin();
    const id = String(u._id);
    await enroll(id);
    const now = Date.now();
    expect((await getMfaState(id, SID, now + STEP_UP_WINDOW_MS - MIN)).stepUpFresh).toBe(true);
    const later = await getMfaState(id, SID, now + STEP_UP_WINDOW_MS + MIN);
    expect(later).toMatchObject({ verified: true, stepUpFresh: false });
  });

  it("a reset removes the second factor and every verified login", async () => {
    const u = await admin();
    const id = String(u._id);
    await enroll(id, "A");
    await MfaSession.create({ userId: id, sid: "B", verifiedAt: new Date(), stepUpAt: new Date() });
    expect(await resetMfa(id)).toBe(true);
    expect(await getMfaState(id, "A")).toEqual({ enrolled: false, verified: false, stepUpFresh: false });
    expect(await resetMfa(id)).toBe(false);
  });
});

// --- through the real routes ---------------------------------------------------
// `sid` null means a login with no ID (a Bearer token); leaving it out uses the default login.
const as = (u: { _id: unknown; role: string }, sid: string | null = SID) =>
  authMock.mockResolvedValue({ user: { id: String(u._id), role: u.role, email: "a@example.test", sid: sid ?? undefined } });
const get = (path: string) => new NextRequest(`https://app.test${path}`);
const post = (path: string, body?: unknown, method = "POST") =>
  new NextRequest(`https://app.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const json = async (res: Response) => res.json();

describe("the admin area needs the second factor", () => {
  it("an admin with no setup, or who has not verified this login, is refused everywhere", async () => {
    const a = await admin();
    as(a);
    let res = await usersGet(get("/api/v1/admin/users"));
    expect(res.status).toBe(403);
    expect((await json(res)).code).toBe("MFA_SETUP_REQUIRED");

    await enroll(String(a._id), "other-login");
    res = await usersGet(get("/api/v1/admin/users"));
    expect(res.status).toBe(403);
    expect((await json(res)).code).toBe("MFA_REQUIRED");

    // The same two checks cover the admin reads on shared routes.
    expect((await withdrawalsGet(get("/api/v1/withdrawals"))).status).toBe(403);
    expect((await paymentsHistory(get("/api/v1/payments/history"))).status).toBe(403);
  });

  it("works once this login has verified, and not for a different login", async () => {
    const a = await admin();
    await enroll(String(a._id), SID);
    as(a, SID);
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(200);
    expect((await withdrawalsGet(get("/api/v1/withdrawals"))).status).toBe(200);
    as(a, "someone-elses-login");
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(403);
    as(a, null); // a Bearer token carries no login ID
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(403);
  });

  it("does not apply to the read-only demo admin, and does not weaken the role checks", async () => {
    const demo = await admin("demo_admin");
    as(demo);
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(200);
    const buyer = await createUser(0);
    as({ _id: buyer._id, role: "buyer" });
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(401);
  });

  it("with MFA_ENFORCED=false (local development) it is off", async () => {
    process.env.MFA_ENFORCED = "false";
    try {
      const a = await admin();
      as(a);
      expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(200);
    } finally {
      process.env.MFA_ENFORCED = "true";
    }
  });
});

describe("sensitive actions need a code from the last 15 minutes", () => {
  async function pendingWithdrawal() {
    const worker = await User.create({ name: "w", email: `w${Math.random()}@example.test`, role: "worker", coins: 500 });
    return Withdrawal.create({
      workerId: worker._id, workerName: "W", workerEmail: worker.email,
      coinRequested: 200, amount: 10, paymentSystem: "bkash", accountNumber: "017",
    });
  }
  const approve = (w: { _id: unknown }) =>
    withdrawalPatch(post(`/api/v1/withdrawals/${w._id}/approve`, { action: "approve" }, "PATCH"), ctx(w._id));

  it("an expired step-up is refused with STEP_UP_REQUIRED, and nothing changes", async () => {
    const a = await admin();
    const id = String(a._id);
    const { secret } = await enroll(id);
    as(a);
    await MfaSession.updateOne({ userId: id, sid: SID }, { $set: { stepUpAt: new Date(Date.now() - STEP_UP_WINDOW_MS - MIN) } });

    const w = await pendingWithdrawal();
    const res = await approve(w);
    expect(res.status).toBe(403);
    expect((await json(res)).code).toBe("STEP_UP_REQUIRED");
    expect((await Withdrawal.findById(w._id))?.status).toBe("pending");
    expect(await AuditLog.countDocuments()).toBe(0);

    // A fresh code renews it, and the action then goes through.
    const verified = await verifyPost(post("/api/v1/admin/mfa/verify", { code: await freshCode(id, secret) }));
    expect(verified.status).toBe(200);
    expect((await approve(w)).status).toBe(200);
    expect((await Withdrawal.findById(w._id))?.status).toBe("approved");
    expect(await AuditLog.countDocuments({ action: "withdrawal.approve" })).toBe(1);
  });

  it("ordinary admin reads do not need the step-up", async () => {
    const a = await admin();
    const id = String(a._id);
    await enroll(id);
    as(a);
    await MfaSession.updateOne({ userId: id, sid: SID }, { $set: { stepUpAt: new Date(Date.now() - 2 * STEP_UP_WINDOW_MS) } });
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(200);
  });

  it("opening the ledger needs the step-up only when it writes", async () => {
    const a = await admin();
    const id = String(a._id);
    await enroll(id);
    as(a);
    await MfaSession.updateOne({ userId: id, sid: SID }, { $set: { stepUpAt: new Date(Date.now() - 2 * STEP_UP_WINDOW_MS) } });
    expect((await ledgerOpen(post("/api/v1/admin/ledger/open"), undefined)).status).toBe(200);
    const apply = await ledgerOpen(post("/api/v1/admin/ledger/open?apply=1"), undefined);
    expect(apply.status).toBe(403);
    expect((await json(apply)).code).toBe("STEP_UP_REQUIRED");
  });
});

describe("the two-factor endpoints", () => {
  it("walk an unverified admin through setup, confirmation and login", async () => {
    const a = await admin();
    const id = String(a._id);
    as(a, "fresh-login");

    expect(await json(await statusGet())).toEqual({ enrolled: false, verified: false, stepUpFresh: false });
    const setup = await json(await setupPost());
    expect(setup.qrDataUrl).toMatch(/^data:image\/png/);

    const bad = await enablePost(post("/api/v1/admin/mfa/enable", { code: "000000" }));
    expect(bad.status).toBe(400);
    const missing = await enablePost(post("/api/v1/admin/mfa/enable", {}));
    expect(missing.status).toBe(400);

    const enabled = await enablePost(post("/api/v1/admin/mfa/enable", { code: totpForStep(setup.manualKey, currentStep()) }));
    expect(enabled.status).toBe(200);
    expect((await json(enabled)).recoveryCodes).toHaveLength(10);
    expect((await setupPost()).status).toBe(409);
    expect((await json(await statusGet())).verified).toBe(true);
    expect(await AuditLog.countDocuments({ action: "mfa.enroll", targetId: id })).toBe(1);

    // A later login must verify before the admin area opens.
    as(a, "next-login");
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(403);
    const ok = await verifyPost(post("/api/v1/admin/mfa/verify", { code: await freshCode(id, setup.manualKey) }));
    expect(ok.status).toBe(200);
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(200);
  });

  it("answers wrong codes with 401 and a lockout with 429 and a Retry-After", async () => {
    const a = await admin();
    const id = String(a._id);
    await enroll(id, "old");
    as(a, "new-login");
    for (let i = 0; i < 4; i++) {
      expect((await verifyPost(post("/api/v1/admin/mfa/verify", { code: "000001" }))).status).toBe(401);
    }
    const locked = await verifyPost(post("/api/v1/admin/mfa/verify", { code: "000001" }));
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await verifyPost(post("/api/v1/admin/mfa/verify", { code: "000001" }))).status).toBe(429);
  });

  it("logs the use of a recovery code", async () => {
    const a = await admin();
    const id = String(a._id);
    const { recoveryCodes } = await enroll(id, "old");
    as(a, "new-login");
    const res = await verifyPost(post("/api/v1/admin/mfa/verify", { code: recoveryCodes[0] }));
    expect(res.status).toBe(200);
    expect((await json(res)).recoveryCodesLeft).toBe(9);
    expect(await AuditLog.countDocuments({ action: "mfa.recovery_used", targetId: id })).toBe(1);
  });

  it("says so, and stays closed, when the server has no encryption key", async () => {
    const a = await admin();
    as(a, "fresh-login");
    const key = process.env.MFA_ENCRYPTION_KEY;
    delete process.env.MFA_ENCRYPTION_KEY;
    try {
      const res = await setupPost();
      expect(res.status).toBe(503);
      expect((await json(res)).code).toBe("MFA_NOT_CONFIGURED");
      // Nothing was created, and the admin area is still closed to this admin.
      expect(await MfaCredential.countDocuments()).toBe(0);
      expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(403);
    } finally {
      process.env.MFA_ENCRYPTION_KEY = key;
    }
  });

  it("are for admins only; the demo admin and others are turned away", async () => {
    const demo = await admin("demo_admin");
    as(demo);
    expect((await setupPost()).status).toBe(403); // the demo admin cannot change anything
    const buyer = await createUser(0);
    as({ _id: buyer._id, role: "buyer" });
    expect((await statusGet()).status).toBe(401);
    authMock.mockResolvedValue(null);
    expect((await verifyPost(post("/api/v1/admin/mfa/verify", { code: "123456" }))).status).toBe(401);
  });
});

describe("lost phone: another admin resets it", () => {
  async function twoAdmins() {
    const a = await admin();
    const b = await admin();
    await enroll(String(a._id), "A-login");
    await enroll(String(b._id), "B-login");
    return { a, b };
  }
  const reset = (id: unknown) => resetPost(post(`/api/v1/admin/users/${id}/mfa-reset`), ctx(id));

  it("clears the other admin's factor and logins, and is audit-logged", async () => {
    const { a, b } = await twoAdmins();
    as(a, "A-login");
    const res = await reset(b._id);
    expect(res.status).toBe(200);
    expect(await getMfaState(String(b._id), "B-login")).toEqual({ enrolled: false, verified: false, stepUpFresh: false });
    const log = await AuditLog.find({ action: "mfa.reset" }).lean();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actorId: String(a._id), targetId: String(b._id) });
    // b must set up again, so the admin area is closed to them.
    as(b, "B-login");
    expect((await usersGet(get("/api/v1/admin/users"))).status).toBe(403);
  });

  it("refuses a self-reset, a non-admin target, a target with no factor and an expired step-up", async () => {
    const { a, b } = await twoAdmins();
    as(a, "A-login");
    expect((await reset(a._id)).status).toBe(400);

    const worker = await User.create({ name: "w", email: "w@example.test", role: "worker" });
    expect((await reset(worker._id)).status).toBe(404);
    expect((await reset(new mongoose.Types.ObjectId())).status).toBe(404);
    expect((await reset("nope")).status).toBe(404);

    await resetMfa(String(b._id));
    expect((await reset(b._id)).status).toBe(404);

    await MfaSession.updateOne({ userId: String(a._id), sid: "A-login" }, { $set: { stepUpAt: new Date(Date.now() - 2 * STEP_UP_WINDOW_MS) } });
    const c = await admin();
    await enroll(String(c._id), "C-login");
    const stale = await reset(c._id);
    expect(stale.status).toBe(403);
    expect((await json(stale)).code).toBe("STEP_UP_REQUIRED");
    expect((await getMfaState(String(c._id), "C-login")).enrolled).toBe(true);
    expect(await AuditLog.countDocuments({ action: "mfa.reset" })).toBe(0);
  });
});
