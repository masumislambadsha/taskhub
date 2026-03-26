import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXTAUTH_URL!;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const data = Object.fromEntries(formData) as Record<string, string>;

  
  try {
    const { connectDB } = await import("@/lib/db");
    const Payment = (await import("@/models/Payment")).default;
    await connectDB();
    await Payment.findByIdAndUpdate(data.tran_id, { status: "failed" });
  } catch {}

  return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
}
