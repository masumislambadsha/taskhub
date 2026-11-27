import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import Dispute from "@/models/Dispute";
import PayoutAccount from "@/models/PayoutAccount";
import Submission from "@/models/Submission";
import User from "@/models/User";
import { createPreLedgerTask, startTestDb } from "@/lib/payments/test-utils";
import {
  EARNINGS_SPIKE_MIN_COINS,
  LEVEL_POINTS,
  assessWithdrawalRisk,
  normalizeAccountNumber,
} from "@/lib/withdrawal-risk";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_withdrawal_risk_test");
  await Promise.all([PayoutAccount.init(), Dispute.init()]);
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([PayoutAccount.deleteMany({}), Dispute.deleteMany({})]);
});

const DAY = 24 * 3600_000;
const codes = (r: { flags: { code: string }[] }) => r.flags.map((f) => f.code).sort();

/** A worker whose account is `ageDays` old. */
async function worker(ageDays = 30) {
  const u = await User.create({ name: "w", email: `w${Math.random()}@example.test`, role: "worker" });
  await User.collection.updateOne({ _id: u._id }, { $set: { createdAt: new Date(Date.now() - ageDays * DAY) } });
  return String(u._id);
}
const assess = (userId: string, over: { accountNumber?: string; paymentSystem?: string; now?: Date } = {}) =>
  assessWithdrawalRisk({ userId, paymentSystem: "bkash", accountNumber: "01700000000", ...over });
const useNumber = (userId: string, number: string, hoursAgo: number, system = "bkash") =>
  PayoutAccount.create({
    userId, paymentSystem: system, accountNumber: normalizeAccountNumber(number),
    firstSeenAt: new Date(Date.now() - hoursAgo * 3600_000),
  });

describe("normalizeAccountNumber", () => {
  it("keeps letters and digits only, in lower case", () => {
    expect(normalizeAccountNumber("017-0000 0000")).toBe("01700000000");
    expect(normalizeAccountNumber(" +88 017.0000.0000 ")).toBe("8801700000000");
    expect(normalizeAccountNumber("AB-12 cd")).toBe("ab12cd");
  });
});

describe("assessWithdrawalRisk", () => {
  it("a settled account with nothing unusual has no flags and score 0", async () => {
    expect(await assess(await worker(60))).toEqual({ score: 0, flags: [] });
  });

  it("an account under 7 days old is held", async () => {
    const young = await assess(await worker(3));
    expect(codes(young)).toEqual(["new_account"]);
    expect(young.flags[0].level).toBe("hold");
    expect(young.score).toBe(LEVEL_POINTS.hold);
    expect(codes(await assess(await worker(8)))).toEqual([]);
  });

  it("a payout number first used in the last 48 hours after a different one is held", async () => {
    const id = await worker();
    await useNumber(id, "01811111111", 24 * 20); // the old number
    await useNumber(id, "01700000000", 5); // the new one, 5 hours ago
    const res = await assess(id);
    expect(codes(res)).toEqual(["number_changed"]);
    expect(res.flags[0].level).toBe("hold");
  });

  it("the very first number a worker uses is not a change, and an older change is forgotten", async () => {
    const first = await worker();
    await useNumber(first, "01710000001", 1);
    expect(codes(await assess(first, { accountNumber: "01710000001" }))).toEqual([]);

    const settled = await worker();
    await useNumber(settled, "01720000001", 24 * 20);
    await useNumber(settled, "01720000002", 49);
    expect(codes(await assess(settled, { accountNumber: "01720000002" }))).toEqual([]);

    // A number about to be used for the first time counts as new right now.
    const switching = await worker();
    await useNumber(switching, "01730000001", 24 * 20);
    expect(codes(await assess(switching, { accountNumber: "01730000002" }))).toEqual(["number_changed"]);
  });

  it("the same number on other accounts is high risk, even written differently", async () => {
    const a = await worker();
    const b = await worker();
    const c = await worker();
    await useNumber(b, "017-0000-0000", 100);
    await useNumber(c, "01700000000", 100);
    const res = await assess(a);
    expect(codes(res)).toEqual(["number_shared"]);
    expect(res.flags[0]).toMatchObject({ level: "high" });
    expect(res.flags[0].message).toContain("2 other accounts");
    expect(res.score).toBe(LEVEL_POINTS.high);
    // A different payment system is a different number.
    expect(codes(await assess(a, { paymentSystem: "nagad" }))).toEqual([]);
    // The worker's own use of a number is not "another account".
    expect(codes(await assess(b))).toEqual(["number_shared"]);
  });

  describe("earnings spikes", () => {
    async function earn(workerId: string, coins: number, hoursAgo: number) {
      const buyer = new mongoose.Types.ObjectId();
      const task = await createPreLedgerTask(buyer);
      await Submission.create({
        taskId: task._id, taskTitle: "t", taskBuyerId: buyer, taskBuyerName: "b",
        workerId, workerName: "w", workerEmail: "w@example.test", payableAmount: coins,
        details: "d", status: "approved", decidedAt: new Date(Date.now() - hoursAgo * 3600_000),
      });
    }

    it("flags a day far above the monthly daily average", async () => {
      const id = await worker();
      for (let day = 2; day <= 20; day++) await earn(id, 10, day * 24); // 190 coins over 19 days
      await earn(id, 300, 2); // today
      const res = await assess(id);
      expect(codes(res)).toEqual(["earnings_spike"]);
      expect(res.flags[0].level).toBe("review");
    });

    it("does not flag steady earnings, a small first earning, or a worker with no history", async () => {
      const steady = await worker();
      for (let day = 0; day <= 20; day++) await earn(steady, 40, day * 24 + 2);
      expect(codes(await assess(steady))).toEqual([]);

      const small = await worker();
      await earn(small, EARNINGS_SPIKE_MIN_COINS - 1, 2);
      expect(codes(await assess(small))).toEqual([]);

      expect(codes(await assess(await worker()))).toEqual([]);
    });

    it("flags a large first earning, since there is no average to compare with", async () => {
      const id = await worker();
      await earn(id, EARNINGS_SPIKE_MIN_COINS + 10, 3);
      expect(codes(await assess(id))).toEqual(["earnings_spike"]);
    });
  });

  it("two lost disputes in the last 30 days are a review flag; old or won ones are not", async () => {
    const id = await worker();
    const dispute = (status: string, daysAgo: number) =>
      Dispute.collection.insertOne({
        submissionId: new mongoose.Types.ObjectId(), taskId: new mongoose.Types.ObjectId(),
        workerId: new mongoose.Types.ObjectId(id), buyerId: new mongoose.Types.ObjectId(),
        status, workerStatement: "s", workerEvidence: [], createdAt: new Date(), resolvedAt: new Date(Date.now() - daysAgo * DAY),
      });
    await dispute("resolved_buyer", 5);
    expect(codes(await assess(id))).toEqual([]);
    await dispute("resolved_buyer", 10);
    await dispute("resolved_worker", 1);
    await dispute("resolved_buyer", 45); // too old
    const res = await assess(id);
    expect(codes(res)).toEqual(["lost_disputes"]);
    expect(res.flags[0].message).toContain("2 disputes");
  });

  it("adds the points of every flag, so the riskiest requests sort first", async () => {
    const a = await worker(2); // a new account: hold
    const b = await worker();
    await useNumber(b, "01960000001", 100); // a number used by another account
    const c = await worker(2); // a new account using a shared number
    await useNumber(b, "01960000002", 100);
    await useNumber(c, "01960000002", 100);

    const young = await assess(a, { accountNumber: "01960000009" });
    const sharedOnly = await assess(await worker(), { accountNumber: "01960000001" });
    const both = await assess(c, { accountNumber: "01960000002" });
    expect(young.score).toBe(LEVEL_POINTS.hold);
    expect(sharedOnly.score).toBe(LEVEL_POINTS.high);
    expect(codes(both)).toEqual(["new_account", "number_shared"]);
    expect(both.score).toBe(LEVEL_POINTS.hold + LEVEL_POINTS.high);
    expect(both.score).toBeGreaterThan(sharedOnly.score);
    expect(sharedOnly.score).toBeGreaterThan(young.score);
  });
});
