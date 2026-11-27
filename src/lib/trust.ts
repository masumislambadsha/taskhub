/**
 * The worker trust score (0 to 100) and levels. Plain rules, not machine
 * learning: every point can be explained to the worker, checked by a person and
 * appealed (see docs/adr/0006-trust-score-rules.md).
 */

export const LEVELS = [
  { level: 0, name: "New", min: 0 },
  { level: 1, name: "Regular", min: 30 },
  { level: 2, name: "Skilled", min: 60 },
  { level: 3, name: "Trusted", min: 80 },
] as const;
export type TrustLevel = 0 | 1 | 2 | 3;

/** Approvals needed in the last 90 days before the approval rate counts at all. */
export const MIN_DECIDED_FOR_RATE = 10;
/** A confirmed fraud flag caps the score at this. */
export const FRAUD_CAP = 20;
/** Approved submissions that earn the full volume points. */
export const FULL_VOLUME_APPROVALS = 200;
/** Days of account age that earn the full age points. */
export const FULL_AGE_DAYS = 180;

export interface TrustInput {
  /** Approved and rejected in the last 90 days, excluding approvals from linked accounts. */
  approved90: number;
  rejected90: number;
  /** All approved submissions ever, excluding approvals from linked accounts. */
  approvedTotal: number;
  accountAgeDays: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Disputes the worker lost in the last 90 days. */
  lostDisputes90: number;
  /** Fraud flags confirmed by an admin against this worker. */
  confirmedFlags: number;
}

export interface TrustComponents {
  approvalRate: number;
  volume: number;
  accountAge: number;
  verified: number;
  disputes: number;
  fraud: number;
}

export interface TrustResult {
  score: number;
  level: TrustLevel;
  components: TrustComponents;
  /** True when a confirmed fraud flag held the score down. */
  capped: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function levelForScore(score: number): TrustLevel {
  let level: TrustLevel = 0;
  for (const l of LEVELS) if (score >= l.min) level = l.level;
  return level;
}

export function computeTrust(input: TrustInput): TrustResult {
  const decided = input.approved90 + input.rejected90;
  const components: TrustComponents = {
    // Up to 40: the share of decided submissions that were approved, once there are enough of them.
    approvalRate: decided >= MIN_DECIDED_FOR_RATE ? round1((input.approved90 / decided) * 40) : 0,
    // Up to 15, on a log scale: the first approvals count most.
    volume: round1(Math.min(15, (15 * Math.log10(1 + input.approvedTotal)) / Math.log10(1 + FULL_VOLUME_APPROVALS))),
    // Up to 10: grows linearly over six months.
    accountAge: round1(Math.min(10, (10 * Math.max(0, input.accountAgeDays)) / FULL_AGE_DAYS)),
    // Up to 10: 5 for a verified email, 5 for a verified phone.
    verified: (input.emailVerified ? 5 : 0) + (input.phoneVerified ? 5 : 0),
    // Up to 10: each lost dispute in the last 90 days costs 5.
    disputes: Math.max(0, 10 - 5 * input.lostDisputes90),
    // Up to 15: any confirmed fraud flag removes all of it (and caps the score).
    fraud: input.confirmedFlags > 0 ? 0 : 15,
  };
  const raw = Object.values(components).reduce((a, b) => a + b, 0);
  const capped = input.confirmedFlags > 0 && raw > FRAUD_CAP;
  const score = Math.round(Math.min(100, capped ? FRAUD_CAP : raw));
  return { score, level: levelForScore(score), components, capped };
}

export function levelName(level: number): string {
  return LEVELS.find((l) => l.level === level)?.name ?? "New";
}

/** A sentence for the worker: where they are and what would move them up. */
export function explainTrust(result: TrustResult, input: TrustInput): string[] {
  const lines: string[] = [];
  const next = LEVELS.find((l) => l.level === result.level + 1);
  lines.push(
    next
      ? `Your level: ${levelName(result.level)} (${result.score}). ${next.min - result.score} more points to reach ${next.name}.`
      : `Your level: ${levelName(result.level)} (${result.score}). This is the top level.`,
  );
  const decided = input.approved90 + input.rejected90;
  if (decided < MIN_DECIDED_FOR_RATE) {
    lines.push(`Your approval rate counts after ${MIN_DECIDED_FOR_RATE} reviewed submissions in 90 days (you have ${decided}). It is worth up to 40 points.`);
  } else {
    lines.push(`Approval rate: ${Math.round((input.approved90 / decided) * 100)}% over the last 90 days (up to 40 points).`);
  }
  if (!input.emailVerified || !input.phoneVerified) lines.push("Verified email and phone are worth up to 10 points (verification is not available yet).");
  if (input.lostDisputes90 > 0) lines.push(`${input.lostDisputes90} lost dispute(s) in the last 90 days cost ${5 * input.lostDisputes90} points; they fall away after 90 days.`);
  if (input.confirmedFlags > 0) lines.push("A confirmed fraud flag caps your score at 20. Contact support if you think this is a mistake.");
  return lines;
}

/** Daily earning caps in coins, by level (roadmap 3.3). Tune to the economy. */
export const DAILY_EARNING_CAP: Record<TrustLevel, number> = { 0: 100, 1: 300, 2: 800, 3: 2000 };
/** Withdrawal limits grow with trust: multiplies the base daily and weekly limits. */
export const WITHDRAWAL_LIMIT_MULTIPLIER: Record<TrustLevel, number> = { 0: 1, 1: 1.5, 2: 2.5, 3: 4 };
