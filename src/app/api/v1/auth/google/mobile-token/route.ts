import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { encode } from "next-auth/jwt";

function getJwtSalt(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = await encode({
      salt: getJwtSalt(),
      secret: process.env.NEXTAUTH_SECRET!,
      token: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        coins: session.user.coins,
        picture: session.user.image,
      },
    });

    return NextResponse.json({
      token,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        photoUrl: session.user.image,
        role: session.user.role,
        coins: session.user.coins,
      },
    });
  } catch (error) {
    console.error("Mobile token error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
