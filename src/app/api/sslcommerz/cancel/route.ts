import { NextResponse } from "next/server";

const BASE = process.env.NEXTAUTH_URL!;

export async function POST() {
  return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
}
