/** Shared SSLCommerz helpers */

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

export async function validateSSLPayment(valId: string): Promise<boolean> {
  const res = await fetch(
    `${process.env.SSLCOMMERZ_BASE_URL}/validator/api/validationserverAPI.php?val_id=${valId}&store_id=${process.env.SSLCOMMERZ_STORE_ID}&store_passwd=${process.env.SSLCOMMERZ_STORE_PASSWORD}&format=json`,
  );
  const data = await res.json();
  return data.status === "VALID" || data.status === "VALIDATED";
}
