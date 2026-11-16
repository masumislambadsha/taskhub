import { validateSSLPayment } from "@/lib/sslcommerz";
import { creditPayment, type CreditResult } from "@/lib/payments/credit";
import { logger } from "@/lib/logger";

/**
 * Credits an SSLCommerz payment. `tranId` and `valId` come from the request
 * and are not trusted: SSLCommerz is asked about `valId`, and coins are only
 * added if its answer is VALID/VALIDATED, names exactly this payment as
 * `tran_id`, and matches the payment's amount and currency. Each val_id can
 * credit one payment only (unique index on the payment's validation ID).
 */
export async function verifyAndCreditSSL(
  tranId: string | undefined,
  valId: string | undefined,
  source: "success" | "ipn",
): Promise<CreditResult> {
  const ctx = { source, paymentId: tranId, validationId: valId };
  const refuse = (
    reason: CreditResult["reason"],
    detail: string,
    extra?: object,
  ): CreditResult => {
    logger.warn({ ...ctx, ...extra, reason, detail }, "payment credit refused");
    return { credited: false, reason };
  };

  if (!tranId || !valId) return refuse("not_found", "missing tran_id or val_id");

  const data = await validateSSLPayment(valId);

  if (data.status !== "VALID" && data.status !== "VALIDATED") {
    return refuse("not_paid", "validation status not valid", {
      validationStatus: data.status,
    });
  }
  if (data.val_id !== undefined && data.val_id !== valId) {
    return refuse("gateway_mismatch", "val_id differs from validation response");
  }
  if (data.tran_id !== tranId) {
    return refuse("gateway_mismatch", "tran_id does not match the payment", {
      validatedTranId: data.tran_id,
    });
  }

  const currency = data.currency_type ?? data.currency;
  return creditPayment({
    paymentId: tranId,
    expected: { amount: Number(data.amount), currency },
    gateway: {
      name: "sslcommerz",
      transactionId: data.bank_tran_id || valId,
      validationId: valId,
      meta: {
        status: data.status,
        tran_id: data.tran_id,
        val_id: valId,
        amount: data.amount,
        currency: currency,
        bank_tran_id: data.bank_tran_id,
      },
    },
  });
}
