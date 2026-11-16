import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXTAUTH_URL!;

// Only redirect: this browser POST is unauthenticated, so only the validated
// success and IPN path may change a payment.
export async function POST(req: NextRequest) {
  return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
}
