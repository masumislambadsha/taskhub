import { NextRequest, NextResponse } from "next/server";

function getJwtSalt(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { decode } = await import("next-auth/jwt");

  try {
    const decoded = await decode({
      token,
      salt: getJwtSalt(),
      secret: process.env.NEXTAUTH_SECRET!,
    });
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    return NextResponse.json({
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      coins: decoded.coins,
      picture: decoded.picture,
    });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
