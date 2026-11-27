import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { addBuyerStatement } from "@/lib/ledger/flows/disputes";
import { refuseDemoAdmin } from "@/lib/roles";
import { withRequestLogging } from "@/lib/with-request-logging";

/** The buyer's one reply to an appeal, within 48 hours. */
export const POST = withRequestLogging(
  "/api/v1/disputes/[id]/buyer-statement",
  async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const demo = refuseDemoAdmin(session);
    if (demo) return demo;
    if (!session || session.user.role !== "buyer")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { statement } = (await req.json().catch(() => ({}))) as { statement?: unknown };
    if (typeof statement !== "string")
      return NextResponse.json({ error: "statement is required" }, { status: 400 });

    await connectDB();
    const res = await addBuyerStatement({
      disputeId: (await params).id,
      buyerId: session.user.id,
      statement,
    });
    if (!res.ok) {
      const map = {
        not_found: ["Not found", 404],
        too_late: ["The 48 hours to reply have ended", 409],
        already_answered: ["You have already replied", 409],
        statement_too_short: ["Write at least 30 characters", 400],
      } as const;
      const [error, status] = map[res.reason];
      return NextResponse.json({ error }, { status });
    }
    return NextResponse.json(res.dispute);
  },
);
