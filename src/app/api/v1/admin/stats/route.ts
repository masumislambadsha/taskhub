import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Task from "@/models/Task";
import Payment from "@/models/Payment";
import Withdrawal from "@/models/Withdrawal";

export async function GET() {
  const session = await auth();
  console.log(session?.user)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const [
    totalWorkers,
    totalBuyers,
    totalCoins,
    totalPayments,
    pendingWithdrawals,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments({ role: "worker" }),
    User.countDocuments({ role: "buyer" }),
    User.aggregate([{ $group: { _id: null, total: { $sum: "$coins" } } }]),
    Payment.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Withdrawal.countDocuments({ status: "pending" }),
    User.find().sort("-createdAt").limit(5).lean(),
  ]);

  return NextResponse.json({
    totalWorkers,
    totalBuyers,
    totalCoins: totalCoins[0]?.total ?? 0,
    totalPayments: totalPayments[0]?.total ?? 0,
    pendingWithdrawals,
    recentUsers,
  });
}
