import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await connectDB();

  const record = await PasswordResetToken.findOne({ token });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Token is invalid or has expired" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne({ email: record.email }, { passwordHash });
  await PasswordResetToken.deleteOne({ token });

  return NextResponse.json({ ok: true });
}
