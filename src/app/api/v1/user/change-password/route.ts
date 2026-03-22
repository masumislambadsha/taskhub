import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword || newPassword.length < 6)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.passwordHash)
    return NextResponse.json(
      { error: "No password set on this account" },
      { status: 400 },
    );

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid)
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  return NextResponse.json({ ok: true });
}
