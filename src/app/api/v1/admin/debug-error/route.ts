import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Admin-only route to confirm that error reporting works end to end.
// Everyone who is not a signed-in admin gets a plain 404.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  throw new Error("Sentry test error from /api/v1/admin/debug-error");
}
