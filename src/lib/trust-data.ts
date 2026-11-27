import { Types } from "mongoose";
import Dispute from "@/models/Dispute";
import FraudFlag from "@/models/FraudFlag";
import Submission from "@/models/Submission";
import User from "@/models/User";
import { computeTrust, type TrustInput, type TrustLevel, type TrustResult } from "./trust";

const DAY = 24 * 3600 * 1000;
const HISTORY_KEEP = 90;

/**
 * Gathers the numbers the score needs. Approvals from buyers linked to the worker
 * (a self-dealing flag that is still open or confirmed) do not count.
 */
export async function gatherTrustInput(userId: string, now = new Date()): Promise<TrustInput | null> {
  const id = new Types.ObjectId(userId);
  const user = await User.findById(id).select("createdAt").lean();
  if (!user) return null;
  const since = new Date(now.getTime() - 90 * DAY);

  const linked = await FraudFlag.find({ userId: id, type: "self_dealing", status: { $ne: "dismissed" } })
    .select("evidence.otherUserId")
    .lean();
  const excludedBuyers = linked.map((f) => f.evidence.otherUserId).filter((b): b is NonNullable<typeof b> => Boolean(b));
  const counted = excludedBuyers.length ? { taskBuyerId: { $nin: excludedBuyers } } : {};

  const [approved90, rejected90, approvedTotal, lostDisputes90, confirmedFlags] = await Promise.all([
    Submission.countDocuments({ workerId: id, status: "approved", decidedAt: { $gte: since }, ...counted }),
    Submission.countDocuments({ workerId: id, status: "rejected", decidedAt: { $gte: since } }),
    Submission.countDocuments({ workerId: id, status: "approved", ...counted }),
    Dispute.countDocuments({ workerId: id, status: "resolved_buyer", resolvedAt: { $gte: since } }),
    FraudFlag.countDocuments({ userId: id, status: "confirmed" }),
  ]);

  return {
    approved90,
    rejected90,
    approvedTotal,
    accountAgeDays: Math.floor((now.getTime() - user.createdAt.getTime()) / DAY),
    // There is no email or phone verification yet (roadmap 3.7), so these earn nothing for now.
    emailVerified: false,
    phoneVerified: false,
    lostDisputes90,
    confirmedFlags,
  };
}

/** Recomputes and stores a worker's trust, and adds today's point to the history. */
export async function recomputeTrust(userId: string, now = new Date()): Promise<{ input: TrustInput; result: TrustResult } | null> {
  const input = await gatherTrustInput(userId, now);
  if (!input) return null;
  const result = computeTrust(input);
  const id = new Types.ObjectId(userId);
  await User.updateOne(
    { _id: id },
    { $set: { trust: { score: result.score, level: result.level, components: result.components, capped: result.capped, computedAt: now } } },
  );
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = await User.updateOne(
    { _id: id, "trustHistory.at": { $gte: startOfDay } },
    { $set: { "trustHistory.$[t].score": result.score, "trustHistory.$[t].level": result.level, "trustHistory.$[t].at": now } },
    { arrayFilters: [{ "t.at": { $gte: startOfDay } }] },
  );
  if (!today.modifiedCount) {
    await User.updateOne(
      { _id: id },
      { $push: { trustHistory: { $each: [{ score: result.score, level: result.level, at: now }], $slice: -HISTORY_KEEP } } },
    );
  }
  return { input, result };
}

/** The worker's level, recomputed if the stored value is older than `maxAgeMs` (default one hour). */
export async function ensureTrustLevel(userId: string, maxAgeMs = 3600_000, now = new Date()): Promise<TrustLevel> {
  const user = await User.findById(userId).select("trust").lean();
  if (!user) return 0;
  if (user.trust && now.getTime() - user.trust.computedAt.getTime() < maxAgeMs) return user.trust.level;
  const res = await recomputeTrust(userId, now);
  return res?.result.level ?? 0;
}

/** Nightly pass: recomputes workers whose score is a day old (or missing), oldest first. */
export async function recomputeStaleTrust(limit = 200, now = new Date()): Promise<number> {
  const stale = await User.find({
    role: "worker",
    status: "active",
    $or: [{ trust: { $exists: false } }, { "trust.computedAt": { $lt: new Date(now.getTime() - DAY) } }],
  })
    .sort({ "trust.computedAt": 1 })
    .select("_id")
    .limit(limit)
    .lean();
  for (const u of stale) await recomputeTrust(String(u._id), now);
  return stale.length;
}
