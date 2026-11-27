// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import Dispute from "@/models/Dispute";
import FraudFlag from "@/models/FraudFlag";
import Submission from "@/models/Submission";
import User from "@/models/User";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { createPendingSubmission, createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";
import { ensureTrustLevel, gatherTrustInput, recomputeStaleTrust, recomputeTrust } from "./trust-data";

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb("taskhub_trust_data_test");
  await FraudFlag.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Dispute.deleteMany({});
});

async function worker() {
  const w = await createUser(0);
  await User.updateOne({ _id: w._id }, { $set: { role: "worker" } });
  return w;
}
async function taskOf(buyer: { _id: mongoose.Types.ObjectId }, workers = 50) {
  const res = await createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "B",
    buyerEmail: "b@example.test",
    data: taskInput({ requiredWorkers: workers, payableAmount: 2 }),
  });
  if (!res.ok) throw new Error("setup failed");
  return res.task;
}
async function decided(task: Awaited<ReturnType<typeof taskOf>>, workerId: mongoose.Types.ObjectId, status: "approved" | "rejected", n: number, daysAgo = 1) {
  for (let i = 0; i < n; i++) {
    const s = await createPendingSubmission(task, workerId);
    await Submission.updateOne({ _id: s._id }, { $set: { status, decidedAt: new Date(Date.now() - daysAgo * 86400000) } });
  }
}

describe("gatherTrustInput and recomputeTrust", () => {
  it("counts approvals and rejections from the last 90 days only", async () => {
    const buyer = await createUser(1000);
    const w = await worker();
    const task = await taskOf(buyer);
    await decided(task, w._id, "approved", 6);
    await decided(task, w._id, "rejected", 2);
    await decided(task, w._id, "approved", 3, 120); // older than 90 days: counts for volume only
    const input = await gatherTrustInput(String(w._id));
    expect(input).toMatchObject({ approved90: 6, rejected90: 2, approvedTotal: 9, lostDisputes90: 0, confirmedFlags: 0 });
  });

  it("stores the score, the level and one history point per day", async () => {
    const buyer = await createUser(1000);
    const w = await worker();
    await decided(await taskOf(buyer), w._id, "approved", 12);
    const first = await recomputeTrust(String(w._id));
    expect(first?.result.components.approvalRate).toBe(40);
    await recomputeTrust(String(w._id)); // same day: updates the point, does not add one
    const stored = await User.findById(w._id).lean();
    expect(stored?.trust?.score).toBe(first?.result.score);
    expect(stored?.trust?.level).toBe(first?.result.level);
    expect(stored?.trustHistory).toHaveLength(1);
    await recomputeTrust(String(w._id), new Date(Date.now() + 2 * 86400000));
    expect((await User.findById(w._id).lean())?.trustHistory).toHaveLength(2);
  });

  it("approvals from a buyer linked by a self-dealing flag do not count, until the flag is dismissed", async () => {
    const buyer = await createUser(1000);
    const honest = await createUser(1000);
    const w = await worker();
    await decided(await taskOf(buyer), w._id, "approved", 10);
    await decided(await taskOf(honest), w._id, "approved", 4);
    expect((await gatherTrustInput(String(w._id)))?.approved90).toBe(14);

    const flag = await FraudFlag.create({
      userId: w._id,
      type: "self_dealing",
      accountLevel: true,
      severity: "high",
      evidence: { otherUserId: buyer._id, accounts: 2 },
    });
    expect(await gatherTrustInput(String(w._id))).toMatchObject({ approved90: 4, approvedTotal: 4 });
    await FraudFlag.updateOne({ _id: flag._id }, { $set: { status: "dismissed" } });
    expect((await gatherTrustInput(String(w._id)))?.approved90).toBe(14);
  });

  it("a lost dispute and a confirmed fraud flag are counted", async () => {
    const buyer = await createUser(1000);
    const w = await worker();
    const task = await taskOf(buyer);
    await decided(task, w._id, "rejected", 1);
    const sub = await Submission.findOne({ workerId: w._id });
    await Dispute.create({
      submissionId: sub!._id,
      taskId: task._id,
      workerId: w._id,
      buyerId: buyer._id,
      status: "resolved_buyer",
      workerStatement: "x".repeat(40),
      resolvedAt: new Date(),
    });
    await FraudFlag.create({ userId: w._id, submissionId: sub!._id, type: "duplicate_proof", severity: "high", status: "confirmed", evidence: { otherSubmissionId: new mongoose.Types.ObjectId() } });
    const res = await recomputeTrust(String(w._id));
    expect(res?.input).toMatchObject({ lostDisputes90: 1, confirmedFlags: 1 });
    expect(res?.result.score).toBeLessThanOrEqual(20);
  });
});

describe("ensureTrustLevel and the nightly pass", () => {
  it("uses the stored level while fresh and recomputes when stale", async () => {
    const buyer = await createUser(1000);
    const w = await worker();
    expect(await ensureTrustLevel(String(w._id))).toBe(0);
    await User.updateOne({ _id: w._id }, { $set: { "trust.level": 3 } });
    expect(await ensureTrustLevel(String(w._id))).toBe(3); // fresh: trusted as stored
    await decided(await taskOf(buyer), w._id, "approved", 1);
    expect(await ensureTrustLevel(String(w._id), 3600_000, new Date(Date.now() + 2 * 3600_000))).toBe(0); // stale: recomputed
    expect(await ensureTrustLevel(String(new mongoose.Types.ObjectId()))).toBe(0);
  });

  it("recomputes workers whose score is missing or a day old, and no one else", async () => {
    const [a, b, c] = [await worker(), await worker(), await worker()];
    await recomputeTrust(String(b._id)); // fresh
    await recomputeTrust(String(c._id), new Date(Date.now() - 3 * 86400000)); // old
    expect(await recomputeStaleTrust()).toBe(2);
    for (const u of [a, b, c]) expect((await User.findById(u._id).lean())?.trust).toBeTruthy();
    expect(await recomputeStaleTrust()).toBe(0);
  });
});
