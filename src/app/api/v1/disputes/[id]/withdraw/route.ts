import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { withdrawDispute } from "@/lib/ledger/flows/disputes";
import { refuseDemoAdmin } from "@/lib/roles";
import { withRequestLogging } from "@/lib/with-request-logging";

/** The worker drops their appeal; the rejection then settles as accepted. */
export const POST = withRequestLogging(
  "/api/v1/disputes/[id]/withdraw",
  async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const demo = refuseDemoAdmin(session);
    if (demo) return demo;
    if (!session || session.user.role !== "worker")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const res = await withdrawDispute({ disputeId: (await params).id, workerId: session.user.id });
    if (!res.ok)
      return NextResponse.json(
        { error: res.reason === "buyer_missing" ? "The buyer's account no longer exists" : "Not found" },
        { status: res.reason === "buyer_missing" ? 409 : 404 },
      );
    return NextResponse.json(res.dispute);
  },
);
