import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Withdrawal, { RESERVED_STATUSES, type IWithdrawalDoc } from "@/models/Withdrawal";
import PayoutAccount from "@/models/PayoutAccount";
import User from "@/models/User";
import { SYSTEM_ACCOUNTS, userAccount } from "../accounts";
import { InsufficientCoinsError, UnknownAccountError } from "../errors";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";
import { recordAudit, type AuditContext } from "@/lib/audit";
import { coinsToUsdWithdraw } from "@/lib/coins";
import {
  MIN_WITHDRAWAL_COINS,
  WITHDRAWAL_CONFIRM_LINK_MS,
  WITHDRAWAL_DAILY_LIMIT_COINS,
  WITHDRAWAL_UNCONFIRMED_EXPIRY_MS,
  WITHDRAWAL_WEEKLY_LIMIT_COINS,
} from "@/lib/constants";
import { assessWithdrawalRisk, normalizeAccountNumber } from "@/lib/withdrawal-risk";

const DAY = 24 * 60 * 60 * 1000;
export const MIN_REASON_LENGTH = 5;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export type RequestWithdrawalResult =
  | { ok: true; withdrawal: IWithdrawalDoc; confirmToken: string }
  | { ok: false; reason: "below_minimum" | "insufficient_coins" | "daily_limit" | "weekly_limit" | "worker_missing" };

/**
 * A worker asks to cash out. In one transaction the coins move from the worker
 * to `system:payouts_pending` (so they cannot be spent twice), a risk
 * assessment with readable reasons is stored, and the request waits for the
 * worker to confirm it from the link we email. Nothing is paid until an admin
 * approves it and pays by hand.
 *
 * Daily and weekly limits count every withdrawal that was not rejected or
 * cancelled. They are fixed numbers for now; roadmap 3.4 makes them depend on
 * the worker's trust level.
 */
export async function requestWithdrawal(args: {
  worker: { id: string; name: string; email: string };
  coins: number;
  paymentSystem: string;
  accountNumber: string;
  now?: Date;
}): Promise<RequestWithdrawalResult> {
  const now = args.now ?? new Date();
  const { worker, coins } = args;
  if (!Number.isInteger(coins) || coins < MIN_WITHDRAWAL_COINS) return { ok: false, reason: "below_minimum" };

  // Limits.
  const sumSince = async (since: Date) => {
    const [row] = await Withdrawal.aggregate<{ total: number }>([
      {
        $match: {
          workerId: new mongoose.Types.ObjectId(worker.id),
          status: { $nin: ["rejected", "cancelled"] },
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: null, total: { $sum: "$coinRequested" } } },
    ]);
    return row?.total ?? 0;
  };
  const [day, week] = await Promise.all([sumSince(new Date(now.getTime() - DAY)), sumSince(new Date(now.getTime() - 7 * DAY))]);
  if (day + coins > WITHDRAWAL_DAILY_LIMIT_COINS) return { ok: false, reason: "daily_limit" };
  if (week + coins > WITHDRAWAL_WEEKLY_LIMIT_COINS) return { ok: false, reason: "weekly_limit" };

  const number = normalizeAccountNumber(args.accountNumber);
  // Assess before recording this number, so "first used just now" is detected.
  const risk = await assessWithdrawalRisk({
    userId: worker.id,
    paymentSystem: args.paymentSystem,
    accountNumber: args.accountNumber,
    now,
  });
  const token = newToken();

  try {
    return await inLedgerTransaction(async (session): Promise<RequestWithdrawalResult> => {
      const exists = await User.exists({ _id: worker.id }).session(session);
      if (!exists) return { ok: false, reason: "worker_missing" };

      await PayoutAccount.updateOne(
        { userId: worker.id, paymentSystem: args.paymentSystem, accountNumber: number },
        { $setOnInsert: { firstSeenAt: now } },
        { upsert: true, session },
      );
      const [withdrawal] = await Withdrawal.create(
        [
          {
            workerId: worker.id,
            workerName: worker.name,
            workerEmail: worker.email,
            coinRequested: coins,
            amount: coinsToUsdWithdraw(coins),
            paymentSystem: args.paymentSystem,
            accountNumber: args.accountNumber,
            status: "awaiting_confirmation",
            reservedAt: now,
            confirmTokenHash: sha256(token),
            confirmExpiresAt: new Date(now.getTime() + WITHDRAWAL_CONFIRM_LINK_MS),
            riskScore: risk.score,
            riskFlags: risk.flags,
          },
        ],
        { session },
      );
      await postTransaction(
        {
          type: "withdrawal_request",
          idempotencyKey: `withdrawal-request:${withdrawal._id}`,
          entries: [
            { accountId: userAccount(worker.id), amount: -coins },
            { accountId: SYSTEM_ACCOUNTS.PAYOUTS_PENDING, amount: coins },
          ],
          meta: { withdrawalId: String(withdrawal._id), userId: worker.id },
          createdBy: worker.id,
        },
        session,
      );
      return { ok: true, withdrawal, confirmToken: token };
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) return { ok: false, reason: "insufficient_coins" };
    throw err;
  }
}

export type ConfirmResult =
  | { ok: true; withdrawal: IWithdrawalDoc }
  | { ok: false; reason: "not_found" | "invalid_token" | "expired" };

/** The worker confirms from the emailed link; the request then joins the admin queue. */
export async function confirmWithdrawal(args: {
  withdrawalId: string;
  workerId: string;
  token: string;
  now?: Date;
}): Promise<ConfirmResult> {
  const now = args.now ?? new Date();
  if (!mongoose.isValidObjectId(args.withdrawalId)) return { ok: false, reason: "not_found" };
  const w = await Withdrawal.findOne({
    _id: args.withdrawalId,
    workerId: args.workerId,
    status: "awaiting_confirmation",
  }).lean();
  if (!w) return { ok: false, reason: "not_found" };
  if (typeof args.token !== "string" || !w.confirmTokenHash || sha256(args.token) !== w.confirmTokenHash) {
    return { ok: false, reason: "invalid_token" };
  }
  if (!w.confirmExpiresAt || w.confirmExpiresAt.getTime() < now.getTime()) return { ok: false, reason: "expired" };

  const updated = await Withdrawal.findOneAndUpdate(
    { _id: w._id, status: "awaiting_confirmation", confirmTokenHash: w.confirmTokenHash },
    { $set: { status: "pending", confirmedAt: now }, $unset: { confirmTokenHash: "", confirmExpiresAt: "" } },
    { returnDocument: "after" },
  );
  return updated ? { ok: true, withdrawal: updated } : { ok: false, reason: "not_found" };
}

/** A fresh confirmation link for a request whose first one expired. */
export async function reissueConfirmation(args: {
  withdrawalId: string;
  workerId: string;
  now?: Date;
}): Promise<{ ok: true; withdrawal: IWithdrawalDoc; confirmToken: string } | { ok: false }> {
  const now = args.now ?? new Date();
  if (!mongoose.isValidObjectId(args.withdrawalId)) return { ok: false };
  const token = newToken();
  const updated = await Withdrawal.findOneAndUpdate(
    { _id: args.withdrawalId, workerId: args.workerId, status: "awaiting_confirmation" },
    {
      $set: {
        confirmTokenHash: sha256(token),
        confirmExpiresAt: new Date(now.getTime() + WITHDRAWAL_CONFIRM_LINK_MS),
      },
    },
    { returnDocument: "after" },
  );
  return updated ? { ok: true, withdrawal: updated, confirmToken: token } : { ok: false };
}

export type EndWithdrawalResult =
  | { ok: true; withdrawal: IWithdrawalDoc }
  | { ok: false; reason: "not_found" | "reason_required" };

/**
 * Gives a reserved withdrawal's coins back to the worker and ends it, in one
 * transaction. The status flip is conditional, so two attempts return the
 * coins once. Withdrawals from before reservations (no `reservedAt`) have no
 * coins to return.
 */
async function endAndReturn(args: {
  withdrawalId: string;
  from: IWithdrawalDoc["status"][];
  to: "rejected" | "cancelled";
  set: Record<string, unknown>;
  workerId?: string;
  audit?: AuditContext;
  auditAction?: string;
  reason?: string;
}): Promise<EndWithdrawalResult> {
  if (!mongoose.isValidObjectId(args.withdrawalId)) return { ok: false, reason: "not_found" };
  return inLedgerTransaction(async (session): Promise<EndWithdrawalResult> => {
    const withdrawal = await Withdrawal.findOneAndUpdate(
      {
        _id: args.withdrawalId,
        status: { $in: args.from },
        ...(args.workerId ? { workerId: args.workerId } : {}),
      },
      { $set: { status: args.to, processedAt: new Date(), ...args.set } },
      { session, returnDocument: "after" },
    );
    if (!withdrawal) return { ok: false, reason: "not_found" };

    if (withdrawal.reservedAt) {
      await postTransaction(
        {
          type: "withdrawal_return",
          idempotencyKey: `withdrawal-return:${withdrawal._id}`,
          entries: [
            { accountId: SYSTEM_ACCOUNTS.PAYOUTS_PENDING, amount: -withdrawal.coinRequested },
            { accountId: userAccount(withdrawal.workerId), amount: withdrawal.coinRequested },
          ],
          meta: { withdrawalId: String(withdrawal._id), userId: String(withdrawal.workerId) },
          createdBy: args.audit?.actorId ?? "system",
        },
        session,
      );
    }
    if (args.audit && args.auditAction) {
      await recordAudit(
        args.audit,
        {
          action: args.auditAction,
          targetType: "withdrawal",
          targetId: args.withdrawalId,
          before: { status: args.from.length === 1 ? args.from[0] : "pending" },
          after: { status: args.to, coins: withdrawal.coinRequested, workerId: String(withdrawal.workerId) },
          reason: args.reason,
        },
        session,
      );
    }
    return { ok: true, withdrawal };
  });
}

/** The worker cancels their own request before an admin approves it. */
export function cancelWithdrawal(args: { withdrawalId: string; workerId: string }) {
  return endAndReturn({
    withdrawalId: args.withdrawalId,
    workerId: args.workerId,
    from: ["awaiting_confirmation", "pending"],
    to: "cancelled",
    set: { cancelledAt: new Date(), cancelReason: "cancelled by the worker" },
  });
}

/** An admin rejects a confirmed request. A reason is required, and the coins go back. */
export async function rejectWithdrawal(args: {
  withdrawalId: string;
  audit?: AuditContext;
  reason?: string;
}): Promise<EndWithdrawalResult> {
  const reason = (args.reason ?? "").trim();
  if (reason.length < MIN_REASON_LENGTH) return { ok: false, reason: "reason_required" };
  return endAndReturn({
    withdrawalId: args.withdrawalId,
    from: ["pending", "approved"],
    to: "rejected",
    set: { rejectionReason: reason },
    audit: args.audit,
    auditAction: "withdrawal.reject",
    reason,
  });
}

/**
 * Cancels every request the worker never confirmed within 24 hours and gives
 * the coins back. Safe to run alongside a worker confirming, because both are
 * conditional on the status.
 */
export async function expireUnconfirmedWithdrawals(now: Date = new Date()): Promise<string[]> {
  const stale = await Withdrawal.find({
    status: "awaiting_confirmation",
    createdAt: { $lte: new Date(now.getTime() - WITHDRAWAL_UNCONFIRMED_EXPIRY_MS) },
  })
    .select("_id")
    .lean();
  const cancelled: string[] = [];
  for (const { _id } of stale) {
    const res = await endAndReturn({
      withdrawalId: String(_id),
      from: ["awaiting_confirmation"],
      to: "cancelled",
      set: { cancelledAt: now, cancelReason: "not confirmed within 24 hours" },
    });
    if (res.ok) cancelled.push(String(_id));
  }
  return cancelled;
}

export type ApproveWithdrawalResult =
  | { ok: true; withdrawal: IWithdrawalDoc }
  | { ok: false; reason: "not_found" | "insufficient_coins" };

/**
 * An admin approves a confirmed request, which then waits to be paid by hand.
 * The coins are already reserved. A withdrawal from before reservations
 * reserves its coins now, and is refused (staying pending) if the worker can
 * no longer cover it.
 */
export async function approveWithdrawal(args: {
  withdrawalId: string;
  adminId: string;
  audit?: AuditContext;
}): Promise<ApproveWithdrawalResult> {
  const { withdrawalId, adminId, audit } = args;
  if (!mongoose.isValidObjectId(withdrawalId)) return { ok: false, reason: "not_found" };
  try {
    return await inLedgerTransaction(async (session): Promise<ApproveWithdrawalResult> => {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: withdrawalId, status: "pending" },
        { $set: { status: "approved", approvedAt: new Date(), approvedBy: adminId } },
        { session, returnDocument: "after" },
      );
      if (!withdrawal) return { ok: false, reason: "not_found" };

      if (!withdrawal.reservedAt) {
        await postTransaction(
          {
            type: "withdrawal_request",
            idempotencyKey: `withdrawal-request:${withdrawalId}`,
            entries: [
              { accountId: userAccount(withdrawal.workerId), amount: -withdrawal.coinRequested },
              { accountId: SYSTEM_ACCOUNTS.PAYOUTS_PENDING, amount: withdrawal.coinRequested },
            ],
            meta: { withdrawalId, userId: String(withdrawal.workerId) },
            createdBy: adminId,
          },
          session,
        );
        await Withdrawal.updateOne({ _id: withdrawalId }, { $set: { reservedAt: new Date() } }, { session });
      }
      if (audit) {
        await recordAudit(
          audit,
          {
            action: "withdrawal.approve",
            targetType: "withdrawal",
            targetId: withdrawalId,
            before: { status: "pending" },
            after: { status: "approved", coins: withdrawal.coinRequested, workerId: String(withdrawal.workerId), riskScore: withdrawal.riskScore },
          },
          session,
        );
      }
      return { ok: true, withdrawal };
    });
  } catch (err) {
    // Thrown inside the transaction, so the status flip was rolled back too.
    if (err instanceof InsufficientCoinsError || err instanceof UnknownAccountError) {
      return { ok: false, reason: "insufficient_coins" };
    }
    throw err;
  }
}

export type MarkPaidResult =
  | { ok: true; withdrawal: IWithdrawalDoc }
  | { ok: false; reason: "not_found" | "transaction_id_required" };

/**
 * The admin paid the worker by hand (bKash, Nagad or bank) and enters the
 * external transaction ID. The coins leave `system:payouts_pending` for good
 * (`withdrawal_paid`), once: the status flip from `approved` is conditional.
 */
export async function markWithdrawalPaid(args: {
  withdrawalId: string;
  adminId: string;
  transactionId: string;
  audit?: AuditContext;
}): Promise<MarkPaidResult> {
  const transactionId = (args.transactionId ?? "").trim();
  if (transactionId.length < 3 || transactionId.length > 100) return { ok: false, reason: "transaction_id_required" };
  if (!mongoose.isValidObjectId(args.withdrawalId)) return { ok: false, reason: "not_found" };
  return inLedgerTransaction(async (session): Promise<MarkPaidResult> => {
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: args.withdrawalId, status: "approved", reservedAt: { $exists: true } },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          paidBy: args.adminId,
          externalTransactionId: transactionId,
          processedAt: new Date(),
        },
      },
      { session, returnDocument: "after" },
    );
    if (!withdrawal) return { ok: false, reason: "not_found" };
    await postTransaction(
      {
        type: "withdrawal_paid",
        idempotencyKey: `withdrawal-paid:${withdrawal._id}`,
        entries: [
          { accountId: SYSTEM_ACCOUNTS.PAYOUTS_PENDING, amount: -withdrawal.coinRequested },
          { accountId: SYSTEM_ACCOUNTS.ISSUANCE, amount: withdrawal.coinRequested },
        ],
        meta: { withdrawalId: String(withdrawal._id), userId: String(withdrawal.workerId) },
        createdBy: args.adminId,
      },
      session,
    );
    if (args.audit) {
      await recordAudit(
        args.audit,
        {
          action: "withdrawal.paid",
          targetType: "withdrawal",
          targetId: String(withdrawal._id),
          before: { status: "approved" },
          after: { status: "paid", coins: withdrawal.coinRequested, transactionId },
        },
        session,
      );
    }
    return { ok: true, withdrawal };
  });
}

export { RESERVED_STATUSES };
