import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await req.json();
  await connectDB();

  const payment = await Payment.findOne({ _id: paymentId, status: "pending" });
  if (!payment) {
    return NextResponse.json(
      { error: "Payment not found or already confirmed" },
      { status: 404 },
    );
  }

  payment.status = "success";
  await payment.save();
  await User.findByIdAndUpdate(payment.userId, {
    $inc: { coins: payment.coinsPurchased },
  });

  return NextResponse.json({ ok: true });
}
