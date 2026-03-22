import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";

// Used for sandbox (bKash/SSLCommerz) and success redirect confirmation
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentId } = await req.json();
  await connectDB();

  const payment = await Payment.findOne({
    _id: paymentId,
    userId: session.user.id,
    status: "pending",
  });
  if (!payment)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  payment.status = "success";
  await payment.save();
  await User.findByIdAndUpdate(session.user.id, {
    $inc: { coins: payment.coinsPurchased },
  });

  return NextResponse.json({ coins: payment.coinsPurchased });
}
