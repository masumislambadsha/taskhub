// @vitest-environment node
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import AuditLog from "@/models/AuditLog";
import Notification from "@/models/Notification";
import Outbox from "@/models/Outbox";
import User from "@/models/User";
import WorkerApplication from "@/models/WorkerApplication";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";
import { SYSTEM_AUDIT } from "@/lib/audit";
import {
  decideApplication,
  purgeRejectedDocuments,
  readDocument,
  requireApprovedWorker,
  saveStep,
  signDocumentUrl,
  submitApplication,
  uploadDocument,
  verifyDocumentSignature,
  workerStatusOf,
} from "./worker-verification";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/queue/auto-approve-queue", () => ({
  scheduleAutoApprove: vi.fn(async () => true),
  scheduleProofHash: vi.fn(async () => true),
  scheduleAiProofCheck: vi.fn(async () => true),
  scheduleDisputeWindow: vi.fn(async () => true),
  cancelDisputeWindow: vi.fn(async () => undefined),
  cancelAutoApprove: vi.fn(async () => undefined),
}));

import { POST as submitWorkPost } from "@/app/api/v1/submissions/route";
import { POST as withdrawPost } from "@/app/api/v1/withdrawals/route";
import { GET as docGet } from "@/app/api/v1/admin/worker-documents/[fileId]/route";
import { POST as decidePost } from "@/app/api/v1/admin/worker-applications/[id]/decide/route";
import { GET as queueGet } from "@/app/api/v1/admin/worker-applications/route";

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb("taskhub_worker_verification_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([WorkerApplication.deleteMany({}), Notification.deleteMany({}), Outbox.collection.deleteMany({})]);
  await AuditLog.collection.deleteMany({});
  vi.clearAllMocks();
});

async function newWorker(status?: "unverified" | "pending" | "approved" | "rejected") {
  const u = await createUser(0);
  await User.updateOne({ _id: u._id }, { $set: { role: "worker", ...(status ? { workerStatus: status } : {}) } });
  return u;
}
const png = () => sharp({ create: { width: 200, height: 120, channels: 3, background: "#336699" } }).png().toBuffer();
async function fullApplication(userId: string) {
  expect((await saveStep(userId, "profile", { fullName: "Rahim Uddin", country: "Bangladesh", birthYear: 1998 })).ok).toBe(true);
  expect((await saveStep(userId, "payout", { paymentSystem: "bkash", accountNumber: "01712345678" })).ok).toBe(true);
  expect((await saveStep(userId, "skills", { skillsNote: "Data entry and translation work." })).ok).toBe(true);
  expect((await uploadDocument(userId, "id", await png())).ok).toBe(true);
}
const adminCtx = { actorId: "admin-1", actorRole: "admin" };

describe("status and the server-side guard", () => {
  it("an account from before verification counts as approved, new workers start unverified, other roles are unaffected", async () => {
    const legacy = await newWorker();
    expect(await workerStatusOf(String(legacy._id))).toBe("approved");
    expect(await requireApprovedWorker(String(legacy._id))).toBeNull();
    const fresh = await newWorker("unverified");
    expect(await workerStatusOf(String(fresh._id))).toBe("unverified");
    const buyer = await createUser(0);
    expect(await workerStatusOf(String(buyer._id))).toBe("approved");
    expect(await workerStatusOf(String(new mongoose.Types.ObjectId()))).toBe("approved");
  });

  it.each(["unverified", "pending", "rejected"] as const)("a %s worker is refused on submit and withdraw, whatever the session says", async (status) => {
    const buyer = await createUser(1000);
    const w = await newWorker(status);
    const res = await createFundedTask({ buyerId: String(buyer._id), buyerName: "B", buyerEmail: "b@x.test", data: taskInput({ requiredWorkers: 2, payableAmount: 5 }) });
    if (!res.ok) throw new Error("setup failed");
    authMock.mockResolvedValue({ user: { id: String(w._id), role: "worker", name: "W", email: w.email } });

    const submit = await submitWorkPost(
      new NextRequest("https://app.test/api/v1/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: String(res.task._id), details: "Done, details here.", proofLinks: ["https://example.com/p"] }) }),
      undefined as never,
    );
    expect(submit.status).toBe(403);
    expect((await submit.json()).code).toBe("WORKER_NOT_APPROVED");

    const withdraw = await withdrawPost(
      new NextRequest("https://app.test/api/v1/withdrawals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ coins: 200, paymentSystem: "bkash", accountNumber: "01711111111" }) }),
      undefined as never,
    );
    expect(withdraw.status).toBe(403);
    expect((await withdraw.json()).code).toBe("WORKER_NOT_APPROVED");
  });

  it("an approved worker (and a legacy one) can still submit", async () => {
    const buyer = await createUser(1000);
    const res = await createFundedTask({ buyerId: String(buyer._id), buyerName: "B", buyerEmail: "b@x.test", data: taskInput({ requiredWorkers: 3, payableAmount: 5 }) });
    if (!res.ok) throw new Error("setup failed");
    for (const status of ["approved", undefined] as const) {
      const w = await newWorker(status);
      authMock.mockResolvedValue({ user: { id: String(w._id), role: "worker", name: "W", email: w.email } });
      const r = await submitWorkPost(
        new NextRequest("https://app.test/api/v1/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: String(res.task._id), details: "Done, details here.", proofLinks: ["https://example.com/p"] }) }),
        undefined as never,
      );
      expect(r.status).toBe(201);
    }
  });
});

describe("the application form", () => {
  it("saves steps on their own, validates them, and only while editable", async () => {
    const w = await newWorker("unverified");
    const id = String(w._id);
    expect(await saveStep(id, "profile", { fullName: "x" })).toMatchObject({ ok: false, reason: "invalid" });
    expect((await saveStep(id, "profile", { fullName: "Rahim Uddin", country: "Bangladesh" })).ok).toBe(true);
    expect((await WorkerApplication.findOne({ userId: w._id }).lean())?.profile?.fullName).toBe("Rahim Uddin");
    expect(await saveStep(id, "payout", { paymentSystem: "paypal", accountNumber: "123456" })).toMatchObject({ reason: "invalid" });
    const approved = await newWorker("approved");
    expect(await saveStep(String(approved._id), "profile", { fullName: "Rahim Uddin", country: "Bangladesh" })).toEqual({ ok: false, reason: "not_editable" });
  });

  it("checks documents by content, re-encodes images, refuses oversize files and a PDF selfie, and replaces the old file", async () => {
    const w = await newWorker("unverified");
    const id = String(w._id);
    expect(await uploadDocument(id, "id", Buffer.from("not an image at all"))).toEqual({ ok: false, reason: "bad_type" });
    expect(await uploadDocument(id, "id", Buffer.alloc(5 * 1024 * 1024 + 1, 1))).toEqual({ ok: false, reason: "too_large" });
    expect(await uploadDocument(id, "selfie", Buffer.from("%PDF-1.4 fake"))).toEqual({ ok: false, reason: "bad_type" });

    const first = await uploadDocument(id, "id", await png());
    if (!first.ok) throw new Error("upload failed");
    const doc = await readDocument(first.fileId);
    expect(doc?.contentType).toBe("image/jpeg"); // re-encoded
    expect(doc?.data[0]).toBe(0xff);
    expect(doc?.userId).toBe(id);
    expect((await uploadDocument(id, "id", Buffer.from("%PDF-1.4 something"))).ok).toBe(true);
    expect(await readDocument(first.fileId)).toBeNull(); // the old file is gone
  });

  it("submits only when complete, moves to pending, and limits attempts to 3", async () => {
    const w = await newWorker("unverified");
    const id = String(w._id);
    expect(await submitApplication(id)).toMatchObject({ ok: false, reason: "incomplete", missing: ["profile", "id document", "payout account", "skills note"] });
    await fullApplication(id);
    expect(await submitApplication(id)).toEqual({ ok: true });
    expect(await workerStatusOf(id)).toBe("pending");
    expect(await submitApplication(id)).toEqual({ ok: false, reason: "not_editable" }); // already pending

    for (let attempt = 2; attempt <= 3; attempt++) {
      const app = await WorkerApplication.findOne({ userId: w._id });
      expect((await decideApplication({ applicationId: String(app!._id), decision: "rejected", reason: "ID is blurry", ctx: adminCtx })).ok).toBe(true);
      expect(await submitApplication(id)).toEqual({ ok: true });
      expect((await WorkerApplication.findOne({ userId: w._id }).lean())?.attempts).toBe(attempt);
    }
    const app = await WorkerApplication.findOne({ userId: w._id });
    await decideApplication({ applicationId: String(app!._id), decision: "rejected", reason: "still wrong", ctx: adminCtx });
    expect(await submitApplication(id)).toEqual({ ok: false, reason: "too_many_attempts" });
  });
});

describe("deciding", () => {
  async function pending() {
    const w = await newWorker("unverified");
    await fullApplication(String(w._id));
    await submitApplication(String(w._id));
    const app = await WorkerApplication.findOne({ userId: w._id });
    return { w, applicationId: String(app!._id) };
  }

  it("approval opens earning, writes exactly one audit entry and a notice, and cannot be repeated", async () => {
    const { w, applicationId } = await pending();
    expect(await decideApplication({ applicationId, decision: "approved", ctx: adminCtx })).toEqual({ ok: true });
    expect(await workerStatusOf(String(w._id))).toBe("approved");
    const stored = await User.findById(w._id).lean();
    expect(stored?.workerReviewedBy).toBe("admin-1");
    expect(await AuditLog.countDocuments({ action: "worker_application.approved", targetId: applicationId })).toBe(1);
    expect(await Outbox.countDocuments({ idempotencyKey: `worker-application:${applicationId}:1:approved` })).toBe(1);
    expect(await decideApplication({ applicationId, decision: "rejected", reason: "changed my mind", ctx: adminCtx })).toEqual({ ok: false, reason: "not_pending" });
    expect(await AuditLog.countDocuments({ targetType: "worker_application" })).toBe(1);
  });

  it("a rejection needs a reason, stores it, and schedules the documents for deletion", async () => {
    const { w, applicationId } = await pending();
    expect(await decideApplication({ applicationId, decision: "rejected", ctx: adminCtx })).toEqual({ ok: false, reason: "reason_required" });
    expect(await decideApplication({ applicationId, decision: "rejected", reason: "no", ctx: adminCtx })).toEqual({ ok: false, reason: "reason_required" });
    expect(await decideApplication({ applicationId, decision: "rejected", reason: "The ID photo is cut off", ctx: adminCtx })).toEqual({ ok: true });
    expect(await workerStatusOf(String(w._id))).toBe("rejected");
    expect((await User.findById(w._id).lean())?.workerRejectionReason).toBe("The ID photo is cut off");
    expect((await WorkerApplication.findOne({ userId: w._id }).lean())?.purgeAfter).toBeInstanceOf(Date);
    expect(await decideApplication({ applicationId: "nope", decision: "approved", ctx: adminCtx })).toEqual({ ok: false, reason: "not_found" });
  });

  it("two admins deciding at the same moment produce one decision and one audit entry", async () => {
    const { applicationId } = await pending();
    const results = await Promise.all([
      decideApplication({ applicationId, decision: "approved", ctx: adminCtx }),
      decideApplication({ applicationId, decision: "rejected", reason: "Some reason here", ctx: { ...adminCtx, actorId: "admin-2" } }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await AuditLog.countDocuments({ targetType: "worker_application" })).toBe(1);
  });

  it("deletes the documents of old rejections, and keeps the recent ones", async () => {
    const { w, applicationId } = await pending();
    await decideApplication({ applicationId, decision: "rejected", reason: "Not readable at all", ctx: adminCtx });
    const app = (await WorkerApplication.findOne({ userId: w._id }).lean())!;
    expect(await purgeRejectedDocuments()).toBe(0);
    expect(await readDocument(String(app.idDocumentId))).not.toBeNull();
    await WorkerApplication.updateOne({ _id: app._id }, { $set: { purgeAfter: new Date(Date.now() - 1000) } });
    expect(await purgeRejectedDocuments()).toBe(1);
    expect(await readDocument(String(app.idDocumentId))).toBeNull();
    expect((await WorkerApplication.findOne({ _id: app._id }).lean())?.idDocumentId).toBeUndefined();
  });
});

describe("admin routes and signed document links", () => {
  it("signed links expire, belong to one admin, and cannot be altered", () => {
    const url = signDocumentUrl("a".repeat(24), "admin-1", 1_000_000);
    const q = new URL(url, "https://x.test").searchParams;
    expect(verifyDocumentSignature("a".repeat(24), "admin-1", q.get("exp"), q.get("sig"), 1_000_000 + 60_000)).toBe(true);
    expect(verifyDocumentSignature("a".repeat(24), "admin-1", q.get("exp"), q.get("sig"), 1_000_000 + 6 * 60_000)).toBe(false); // expired
    expect(verifyDocumentSignature("a".repeat(24), "admin-2", q.get("exp"), q.get("sig"), 1_000_000 + 1000)).toBe(false); // another admin
    expect(verifyDocumentSignature("b".repeat(24), "admin-1", q.get("exp"), q.get("sig"), 1_000_000 + 1000)).toBe(false); // another file
    expect(verifyDocumentSignature("a".repeat(24), "admin-1", q.get("exp"), "0".repeat(64), 1_000_000 + 1000)).toBe(false);
    expect(verifyDocumentSignature("a".repeat(24), "admin-1", String(1_000_000 + 99 * 60_000), q.get("sig"), 1_000_000 + 1000)).toBe(false);
  });

  it("the demo admin and non-admins cannot read the queue or open documents; a full admin can, and every view is audited", async () => {
    const w = await newWorker("unverified");
    await fullApplication(String(w._id));
    await submitApplication(String(w._id));
    const app = (await WorkerApplication.findOne({ userId: w._id }).lean())!;
    const fileId = String(app.idDocumentId);
    const adminId = String(new mongoose.Types.ObjectId());

    for (const role of ["worker", "buyer", "demo_admin"]) {
      authMock.mockResolvedValue({ user: { id: adminId, role } });
      expect((await queueGet()).status).toBeGreaterThanOrEqual(401);
      const link = new URL(signDocumentUrl(fileId, adminId), "https://x.test");
      expect((await docGet(new NextRequest(link), { params: Promise.resolve({ fileId }) })).status).toBeGreaterThanOrEqual(401);
    }
    expect(await AuditLog.countDocuments({ action: "worker_document.view" })).toBe(0);

    authMock.mockResolvedValue({ user: { id: adminId, role: "admin" } });
    expect((await (await queueGet()).json()).applications).toHaveLength(1);
    const good = new URL(signDocumentUrl(fileId, adminId), "https://x.test");
    const ok = await docGet(new NextRequest(good), { params: Promise.resolve({ fileId }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect(ok.headers.get("content-type")).toBe("image/jpeg");
    expect(await AuditLog.countDocuments({ action: "worker_document.view", targetId: fileId })).toBe(1);

    const bad = new URL(`/api/v1/admin/worker-documents/${fileId}?exp=${Date.now() + 1000}&sig=${"0".repeat(64)}`, "https://x.test");
    expect((await docGet(new NextRequest(bad), { params: Promise.resolve({ fileId }) })).status).toBe(403);
    expect(await AuditLog.countDocuments({ action: "worker_document.view" })).toBe(1);
  });

  it("deciding needs a full admin with two-factor step-up", async () => {
    const w = await newWorker("unverified");
    await fullApplication(String(w._id));
    await submitApplication(String(w._id));
    const app = (await WorkerApplication.findOne({ userId: w._id }).lean())!;
    const req = (body: unknown) => new NextRequest("https://x.test/api", { method: "POST", body: JSON.stringify(body) });
    const params = { params: Promise.resolve({ id: String(app._id) }) };

    authMock.mockResolvedValue({ user: { id: "a1", role: "demo_admin" } });
    expect((await decidePost(req({ decision: "approved" }), params)).status).toBe(403);
    authMock.mockResolvedValue({ user: { id: "a1", role: "buyer" } });
    expect((await decidePost(req({ decision: "approved" }), params)).status).toBe(401);
    authMock.mockResolvedValue({ user: { id: String(new mongoose.Types.ObjectId()), role: "admin" } });
    expect((await decidePost(req({ decision: "maybe" }), params)).status).toBe(400);
    expect(await workerStatusOf(String(w._id))).toBe("pending");
  });
});
