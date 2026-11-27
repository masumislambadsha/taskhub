import mongoose from "mongoose";
import Dispute from "@/models/Dispute";
import PayoutAccount from "@/models/PayoutAccount";
import Submission from "@/models/Submission";
import User from "@/models/User";
import type { RiskFlag } from "@/models/Withdrawal";

const DAY = 24 * 60 * 60 * 1000;
export const NEW_ACCOUNT_DAYS = 7;
export const NUMBER_CHANGE_HOURS = 48;
export const EARNINGS_SPIKE_FACTOR = 5;
/** Below this many coins a "spike" is just a first small earning, not a signal. */
export const EARNINGS_SPIKE_MIN_COINS = 50;
export const LOST_DISPUTES_WINDOW_DAYS = 30;
export const LOST_DISPUTES_THRESHOLD = 2;

/** Points each level adds to the score; the admin queue sorts by the total. */
export const LEVEL_POINTS = { review: 20, hold: 40, high: 60 } as const;

export function normalizeAccountNumber(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export interface RiskAssessment {
  score: number;
  flags: RiskFlag[];
}

/**
 * A readable risk assessment of a withdrawal request, made when it is
 * requested. It never blocks a withdrawal by itself: it puts the reasons in
 * front of the admin who approves it, riskiest first.
 *
 * - Account younger than 7 days: hold.
 * - A payout number first used in the last 48 hours by a worker who used a
 *   different one before: hold. This is the classic account-takeover pattern.
 * - The same payout number used by another account: high.
 * - Today's earnings above 5 times the 30-day daily average: review.
 * - Two or more lost disputes in the last 30 days: review.
 *   (Open fraud flags join this when roadmap 3.x exists.)
 */
export async function assessWithdrawalRisk(args: {
  userId: string;
  paymentSystem: string;
  accountNumber: string;
  now?: Date;
}): Promise<RiskAssessment> {
  const now = args.now ?? new Date();
  const number = normalizeAccountNumber(args.accountNumber);
  const flags: RiskFlag[] = [];

  const user = await User.findById(args.userId).select("createdAt").lean();
  if (user?.createdAt && now.getTime() - user.createdAt.getTime() < NEW_ACCOUNT_DAYS * DAY) {
    flags.push({
      code: "new_account",
      level: "hold",
      message: `The account is less than ${NEW_ACCOUNT_DAYS} days old.`,
    });
  }

  const [mine, others] = await Promise.all([
    PayoutAccount.find({ userId: args.userId }).lean(),
    PayoutAccount.countDocuments({
      paymentSystem: args.paymentSystem,
      accountNumber: number,
      userId: { $ne: args.userId },
    }),
  ]);
  const thisOne = mine.find((m) => m.paymentSystem === args.paymentSystem && m.accountNumber === number);
  const usedBefore = mine.filter((m) => m !== thisOne);
  const firstSeen = thisOne?.firstSeenAt ?? now;
  if (usedBefore.length > 0 && now.getTime() - firstSeen.getTime() < NUMBER_CHANGE_HOURS * 3_600_000) {
    flags.push({
      code: "number_changed",
      level: "hold",
      message: `The payout number was first used in the last ${NUMBER_CHANGE_HOURS} hours, and the worker used a different one before.`,
    });
  }
  if (others > 0) {
    flags.push({
      code: "number_shared",
      level: "high",
      message: `The same payout number is used by ${others} other account${others === 1 ? "" : "s"}.`,
    });
  }

  const dayAgo = new Date(now.getTime() - DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const sum = async (from: Date, to: Date) => {
    const [row] = await Submission.aggregate<{ total: number }>([
      {
        $match: {
          workerId: new mongoose.Types.ObjectId(args.userId),
          status: "approved",
          $expr: { $and: [{ $gte: [{ $ifNull: ["$decidedAt", "$updatedAt"] }, from] }, { $lt: [{ $ifNull: ["$decidedAt", "$updatedAt"] }, to] }] },
        },
      },
      { $group: { _id: null, total: { $sum: "$payableAmount" } } },
    ]);
    return row?.total ?? 0;
  };
  const [today, previous] = await Promise.all([sum(dayAgo, now), sum(monthAgo, dayAgo)]);
  const dailyAverage = previous / 29;
  if (today >= EARNINGS_SPIKE_MIN_COINS && today > EARNINGS_SPIKE_FACTOR * dailyAverage) {
    flags.push({
      code: "earnings_spike",
      level: "review",
      message: `Earned ${today} coins in the last 24 hours, more than ${EARNINGS_SPIKE_FACTOR}x the daily average of ${Math.round(dailyAverage)} over the past month.`,
    });
  }

  const lost = await Dispute.countDocuments({
    workerId: args.userId,
    status: "resolved_buyer",
    resolvedAt: { $gte: new Date(now.getTime() - LOST_DISPUTES_WINDOW_DAYS * DAY) },
  });
  if (lost >= LOST_DISPUTES_THRESHOLD) {
    flags.push({
      code: "lost_disputes",
      level: "review",
      message: `Lost ${lost} disputes in the last ${LOST_DISPUTES_WINDOW_DAYS} days.`,
    });
  }

  const score = flags.reduce((sum2, f) => sum2 + LEVEL_POINTS[f.level], 0);
  return { score, flags };
}
