import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { cancelWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { workerWithdrawalView } from "@/lib/withdrawal-view";
import { refuseDemoAdmin } from "@/lib/roles";
import { withRequestLogging } from "@/lib/with-request-logging";

/** The worker cancels their request before an admin approves it; the coins come back. */
export const POST = withRequestLogging(
  "/api/v1/withdrawals/[id]/cancel",
  async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const demo = refuseDemoAdmin(session);
    if (demo) return demo;
    if (!session || session.user.role !== "worker")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const res = await cancelWithdrawal({ withdrawalId: (await params).id, workerId: session.user.id });
    if (!res.ok) return NextResponse.json({ error: "This request can no longer be cancelled" }, { status: 404 });
    return NextResponse.json(workerWithdrawalView(res.withdrawal));
  },
);
