import mongoose from "mongoose";
import Payment from "@/models/Payment";
import type { IPaymentDoc } from "@/models/Payment";
import { logger } from "@/lib/logger";
import { recordAudit, type AuditContext } from "@/lib/audit";
import {
  postTransaction,
  SYSTEM_ACCOUNTS,
  UnknownAccountError,
  userAccount,
} from "@/lib/ledger";

/**
 * Taka charged per US dollar of package price. `Payment.amount` is always the
 * package price in USD; bKash and SSLCommerz are charged in BDT at this rate.
 */
export const BDT_PER_USD = 110;

const AMOUNT_TOLERANCE = 0.01;

export type CreditReason =
  | "credited"
  | "not_found"
  | "already_processed"
  | "not_pending"
  | "not_paid"
  | "gateway_mismatch"
  | "amount_mismatch"
  | "currency_mismatch"
  | "duplicate_gateway_transaction"
  | "user_not_found";

export interface CreditResult {
  credited: boolean;
  reason: CreditReason;
  coins?: number;
}

export interface CreditInput {
  paymentId: string;
  /** For a manual admin confirmation: logs it in the same transaction as the credit. */
  audit?: AuditContext;
  /**
   * What the provider says was paid. Compared with the amount the Payment
   * should have cost, inside the same transaction that credits the coins.
   * Omit only for a manual admin confirmation.
   */
  expected?: { amount: number; currency?: string };
  gateway: {
    name: "stripe" | "bkash" | "sslcommerz" | "admin";
    transactionId?: string;
    validationId?: string;
    /** The admin's user ID, for `name: "admin"`. */
    adminUserId?: string;
    meta?: Record<string, unknown>;
  };
}

/** The amount and currency the provider should have charged for a payment. */
export function expectedCharge(
  payment: Pick<IPaymentDoc, "gateway" | "amount" | "currency">,
): { amount: number; currency: string } {
  if (payment.gateway === "stripe") {
    return { amount: payment.amount, currency: "usd" };
  }
  return {
    amount: Math.round(payment.amount * BDT_PER_USD * 100) / 100,
    currency: "bdt",
  };
}

export function amountsMatch(a: number, b: number): boolean {
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    Math.abs(a - b) <= AMOUNT_TOLERANCE
  );
}

class RollbackError extends Error {
  constructor(public reason: CreditReason) {
    super(reason);
  }
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/**
 * The only place that adds purchased coins to a user's balance.
 *
 * In one MongoDB transaction it flips the payment from `pending` to `success`
 * (only if it is still pending) and, only if that matched, posts the ledger
 * transaction `system:issuance -N, user +N` (key `payment:<paymentId>`). A
 * second call for the same payment, however concurrent, credits nothing.
 */
export async function creditPayment(input: CreditInput): Promise<CreditResult> {
  const { paymentId, expected, gateway, audit } = input;
  const logCtx = {
    paymentId,
    gateway: gateway.name,
    transactionId: gateway.transactionId,
    validationId: gateway.validationId,
    adminUserId: gateway.adminUserId,
  };

  const refuse = (reason: CreditReason, extra?: object): CreditResult => {
    logger.warn({ ...logCtx, ...extra, reason }, "payment credit refused");
    return { credited: false, reason };
  };

  if (!mongoose.isValidObjectId(paymentId)) return refuse("not_found");

  try {
    const result = await mongoose.connection.transaction(
      async (session): Promise<CreditResult> => {
        const payment = await Payment.findById(paymentId).session(session);
        if (!payment) return refuse("not_found");

        if (payment.status !== "pending") {
          return refuse(
            payment.status === "success" ? "already_processed" : "not_pending",
            { status: payment.status },
          );
        }

        if (gateway.name !== "admin" && payment.gateway !== gateway.name) {
          return refuse("gateway_mismatch", { paymentGateway: payment.gateway });
        }

        if (expected) {
          const charge = expectedCharge(payment);
          if (!amountsMatch(expected.amount, charge.amount)) {
            return refuse("amount_mismatch", {
              expectedAmount: charge.amount,
              receivedAmount: expected.amount,
            });
          }
          if (
            expected.currency !== undefined &&
            expected.currency.toLowerCase() !== charge.currency
          ) {
            return refuse("currency_mismatch", {
              expectedCurrency: charge.currency,
              receivedCurrency: expected.currency,
            });
          }
        }

        const $set: Record<string, unknown> = {
          status: "success",
          paidAt: new Date(),
          creditedVia: gateway.name,
        };
        if (gateway.transactionId)
          $set.gatewayTransactionId = gateway.transactionId;
        if (gateway.validationId)
          $set.gatewayValidationId = gateway.validationId;
        if (gateway.meta) $set.meta = gateway.meta;
        if (gateway.adminUserId) $set.confirmedBy = gateway.adminUserId;

        const updated = await Payment.findOneAndUpdate(
          { _id: paymentId, status: "pending" },
          { $set },
          { session, returnDocument: "after" },
        );
        if (!updated) return refuse("already_processed");

        // The coins come from system:issuance. The ledger posting and the
        // payment status flip above commit or roll back together.
        try {
          await postTransaction(
            {
              type: "topup",
              idempotencyKey: `payment:${paymentId}`,
              entries: [
                {
                  accountId: SYSTEM_ACCOUNTS.ISSUANCE,
                  amount: -updated.coinsPurchased,
                },
                {
                  accountId: userAccount(updated.userId),
                  amount: updated.coinsPurchased,
                },
              ],
              meta: { paymentId },
              createdBy: gateway.adminUserId ?? "system",
            },
            session,
          );
        } catch (err) {
          // Roll the status change back: nobody was credited.
          if (err instanceof UnknownAccountError) {
            throw new RollbackError("user_not_found");
          }
          throw err;
        }

        if (audit) {
          await recordAudit(
            audit,
            {
              action: "payment.admin_confirm",
              targetType: "payment",
              targetId: paymentId,
              before: { status: "pending" },
              after: { status: "success", coins: updated.coinsPurchased, userId: String(updated.userId) },
            },
            session,
          );
        }

        logger.info(
          {
            ...logCtx,
            userId: String(updated.userId),
            coins: updated.coinsPurchased,
          },
          "payment credited",
        );
        return {
          credited: true,
          reason: "credited",
          coins: updated.coinsPurchased,
        };
      },
    );
    return result;
  } catch (err) {
    if (err instanceof RollbackError) return refuse(err.reason);
    if (isDuplicateKey(err)) return refuse("duplicate_gateway_transaction");
    throw err;
  }
}
