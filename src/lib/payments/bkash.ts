import { executeBkashPayment } from "@/lib/bkash";
import { creditPayment } from "@/lib/payments/credit";
import { logger } from "@/lib/logger";

export interface BkashResult {
  /** True when the payment was credited now or earlier. */
  ok: boolean;
  /** Our Payment ID (bKash's merchantInvoiceNumber), when bKash returned one. */
  paymentId?: string;
  reason: string;
}

/**
 * Asks bKash to execute the payment and credits it only if bKash says it is
 * Completed, names this paymentID, and the amount and currency match. The
 * `paymentID` comes from the callback URL and is not trusted.
 */
export async function verifyAndCreditBkash(
  paymentID: string,
): Promise<BkashResult> {
  const execData = await executeBkashPayment(paymentID);
  const dbPaymentId = execData.merchantInvoiceNumber;
  const ctx = { bkashPaymentId: paymentID, paymentId: dbPaymentId };
  const paymentId = dbPaymentId ? String(dbPaymentId) : undefined;

  if (
    execData.statusCode !== "0000" ||
    execData.transactionStatus !== "Completed"
  ) {
    logger.warn(
      {
        ...ctx,
        statusCode: execData.statusCode,
        transactionStatus: execData.transactionStatus,
      },
      "bKash payment not completed",
    );
    return { ok: false, paymentId, reason: "not_paid" };
  }

  if (execData.paymentID !== paymentID || !execData.trxID) {
    logger.warn({ ...ctx, reason: "gateway_mismatch" }, "payment credit refused");
    return { ok: false, paymentId, reason: "gateway_mismatch" };
  }

  const result = await creditPayment({
    paymentId: String(dbPaymentId),
    expected: {
      amount: Number(execData.amount),
      currency: execData.currency,
    },
    gateway: {
      name: "bkash",
      transactionId: execData.trxID,
      meta: execData,
    },
  });

  // "already_processed": an earlier callback for this payment credited it.
  return {
    ok: result.credited || result.reason === "already_processed",
    paymentId,
    reason: result.reason,
  };
}
