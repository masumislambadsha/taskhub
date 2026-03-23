import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { registerSchema } from "@/lib/validators/auth";
import { WORKER_INITIAL_COINS, BUYER_INITIAL_COINS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectDB();
  const { name, email, password, role, photoUrl } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const coins = role === "buyer" ? BUYER_INITIAL_COINS : WORKER_INITIAL_COINS;

  await User.create({ name, email, passwordHash, photoUrl, role, coins });
  return NextResponse.json({ ok: true }, { status: 201 });
}
