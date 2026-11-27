import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { confirmWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { drainOutboxQuietly } from "@/lib/outbox";
import { workerWithdrawalView } from "@/lib/withdrawal-view";
import { refuseDemoAdmin } from "@/lib/roles";
import { withRequestLogging } from "@/lib/with-request-logging";

/** The worker, signed in, confirms a withdrawal with the token from the email link. */
export const POST = withRequestLogging(
  "/api/v1/withdrawals/[id]/confirm",
  async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const demo = refuseDemoAdmin(session);
    if (demo) return demo;
    if (!session || session.user.role !== "worker")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = (await req.json().catch(() => ({}))) as { token?: unknown };
    if (typeof token !== "string" || !token)
      return NextResponse.json({ error: "token is required" }, { status: 400 });

    await connectDB();
    const res = await confirmWithdrawal({
      withdrawalId: (await params).id,
      workerId: session.user.id,
      token,
    });
    if (!res.ok) {
      const map = {
        not_found: ["Not found, or already confirmed", 404],
        invalid_token: ["This confirmation link is not valid", 400],
        expired: ["This link has expired. Ask for a new one.", 410],
      } as const;
      const [error, status] = map[res.reason];
      return NextResponse.json({ error }, { status });
    }
    await drainOutboxQuietly();
    return NextResponse.json(workerWithdrawalView(res.withdrawal));
  },
);
