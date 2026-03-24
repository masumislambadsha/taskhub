import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXTAUTH_URL!;

export async function POST(req: NextRequest) {
  return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
}
