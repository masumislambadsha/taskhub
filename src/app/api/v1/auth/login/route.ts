import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { loginSchema } from "@/lib/validators/auth";
import { encode } from "next-auth/jwt";

function getJwtSalt(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      const text = await req.text();
      try { body = JSON.parse(text); } catch { body = {}; }
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await connectDB();
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    if (user.status === "suspended") {
      return NextResponse.json(
        { error: "Account suspended" },
        { status: 403 },
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const token = await encode({
      salt: getJwtSalt(),
      secret: process.env.NEXTAUTH_SECRET!,
      token: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        coins: user.coins,
        picture: user.photoUrl,
      },
    });

    return NextResponse.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        role: user.role,
        coins: user.coins,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
