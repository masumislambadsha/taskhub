import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { reconcile } from "@/lib/ledger/reconcile";
import { withRequestLogging } from "@/lib/with-request-logging";

/**
 * Admin only. Recomputes every ledger balance from the journal and returns the
 * mismatches (account IDs and amounts only). `ok: true` means zero mismatches
 * and all balances sum to 0.
 */
export const GET = withRequestLogging(
  "/api/v1/admin/ledger/reconcile",
  async function GET() {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    return NextResponse.json(await reconcile());
  },
);
