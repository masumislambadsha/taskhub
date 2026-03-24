import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { amount, paymentId, token } = await req.json();

  if (!token || !amount || !paymentId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const response = await fetch(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authorization: token,
        "x-app-key": process.env.BKASH_APP_KEY!,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: paymentId,
        callbackURL: `${process.env.NEXTAUTH_URL}/api/bkash/callback`,
        amount: amount.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: paymentId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok || data.statusCode !== "0000") {
    return NextResponse.json(
      { error: data.statusMessage || "Failed to create payment" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
