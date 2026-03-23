import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  const shouldRedirect = req.nextUrl.searchParams.get("redirect") === "1";

  if (!session) {
    return shouldRedirect
      ? NextResponse.redirect(new URL("/login", req.url))
      : NextResponse.json({ role: null }, { status: 401 });
  }

  const role = session.user.role;
  console.log("[/api/auth/me] session.user:", JSON.stringify(session.user));

  if (shouldRedirect) {
    const dest =
      role === "admin"
        ? "/admin/dashboard"
        : role === "buyer"
          ? "/buyer/dashboard"
          : "/worker/dashboard";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.json({ role, id: session.user.id });
}
