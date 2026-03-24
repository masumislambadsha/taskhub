import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { amount, paymentId, customerName, customerEmail } = await req.json();

  if (!amount || !paymentId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const BASE = process.env.NEXTAUTH_URL!;

  const params = new URLSearchParams({
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    total_amount: amount.toString(),
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
    cus_name: customerName || "Customer",
    cus_email: customerEmail || "customer@example.com",
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_state: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: "01700000000",
  });

  const response = await fetch(
    `${process.env.SSLCOMMERZ_BASE_URL}/gwprocess/v4/api.php`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  const result = await response.json();

  if (result.status === "SUCCESS" && result.GatewayPageURL) {
    return NextResponse.json({ gatewayUrl: result.GatewayPageURL });
  }

  return NextResponse.json(
    { error: result.failedreason || "Failed to initialize payment" },
    { status: 500 },
  );
}
