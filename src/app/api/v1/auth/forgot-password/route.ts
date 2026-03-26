import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() });

  
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  
  await PasswordResetToken.deleteMany({ email: email.toLowerCase() });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

  await PasswordResetToken.create({
    email: email.toLowerCase(),
    token,
    expiresAt,
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (err) {
    console.error("[forgot-password] Email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send reset email. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
