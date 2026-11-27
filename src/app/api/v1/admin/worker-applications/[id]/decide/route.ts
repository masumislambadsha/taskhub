import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { auditContextFrom } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { decideApplication } from "@/lib/worker-verification";

/** Approve or reject. Needs the admin's two-factor step-up and writes an audit entry in the same transaction. A rejection needs a reason. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(await auth(), "write", { stepUp: true });
  if (!guard.ok) return guard.response;
  const body = await req.json().catch(() => null);
  if (body?.decision !== "approved" && body?.decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 });
  }
  await connectDB();
  const res = await decideApplication({
    applicationId: (await params).id,
    decision: body.decision,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    ctx: auditContextFrom(req, { userId: guard.userId, role: guard.role }),
  });
  if (res.ok) return NextResponse.json({ ok: true });
  if (res.reason === "reason_required") return NextResponse.json({ error: "Give a reason of at least 5 characters." }, { status: 400 });
  if (res.reason === "not_pending") return NextResponse.json({ error: "Already decided." }, { status: 409 });
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
