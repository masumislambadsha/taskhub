import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import User from "@/models/User";
import { withdrawalSchema } from "@/lib/validators/withdrawal";
import { coinsToUsdWithdraw } from "@/lib/coins";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 10;

  const query =
    session.user.role === "worker" ? { workerId: session.user.id } : {};
  const [withdrawals, total] = await Promise.all([
    Withdrawal.find(query)
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Withdrawal.countDocuments(query),
  ]);

  return NextResponse.json({
    withdrawals,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "worker") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = withdrawalSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  await connectDB();
  const worker = await User.findById(session.user.id);
  if (!worker || worker.coins < parsed.data.coinRequested) {
    return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
  }

  const withdrawal = await Withdrawal.create({
    workerId: session.user.id,
    workerName: session.user.name,
    workerEmail: session.user.email,
    coinRequested: parsed.data.coinRequested,
    amount: coinsToUsdWithdraw(parsed.data.coinRequested),
    paymentSystem: parsed.data.paymentSystem,
    accountNumber: parsed.data.accountNumber,
  });

  return NextResponse.json(withdrawal, { status: 201 });
}
