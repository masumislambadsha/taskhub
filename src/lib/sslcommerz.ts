

export async function initSSLCommerz(
  amountBDT: string,
  paymentId: string,
  customerName: string,
  customerEmail: string,
): Promise<string> {
  const BASE = process.env.NEXTAUTH_URL!;

  const params = new URLSearchParams({
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    total_amount: amountBDT,
    currency: "BDT",
    tran_id: paymentId,
    success_url: `${BASE}/api/sslcommerz/success`,
    fail_url: `${BASE}/api/sslcommerz/fail`,
    cancel_url: `${BASE}/api/sslcommerz/cancel`,
    ipn_url: `${BASE}/api/sslcommerz/ipn`,
    shipping_method: "NO",
    product_name: "TaskHub Coins",
    product_category: "Digital",
    product_profile: "non-physical-goods",
    cus_name: customerName,
    cus_email: customerEmail,
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_state: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: "01700000000",
  });

  const res = await fetch(
    `${process.env.SSLCOMMERZ_BASE_URL}/gwprocess/v4/api.php`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  const result = await res.json();
  if (!result.GatewayPageURL)
    throw new Error(result.failedreason || "SSLCommerz init failed");
  return result.GatewayPageURL;
}

/** Fields of the SSLCommerz validation API response that we rely on. */
export interface SSLValidationData {
  status?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  currency_type?: string;
  currency_amount?: string;
  bank_tran_id?: string;
  [key: string]: unknown;
}

/**
 * Asks SSLCommerz about a val_id and returns its answer. This only says what
 * SSLCommerz knows about that val_id: the caller must still check that the
 * status, tran_id, amount and currency belong to the payment being credited.
 */
export async function validateSSLPayment(
  valId: string,
): Promise<SSLValidationData> {
  const query = new URLSearchParams({
    val_id: valId,
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    format: "json",
  });
  const res = await fetch(
    `${process.env.SSLCOMMERZ_BASE_URL}/validator/api/validationserverAPI.php?${query}`,
  );
  if (!res.ok) throw new Error(`SSLCommerz validation failed (${res.status})`);
  return (await res.json()) as SSLValidationData;
}
