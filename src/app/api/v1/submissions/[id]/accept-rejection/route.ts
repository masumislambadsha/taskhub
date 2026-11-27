import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import { settleRejection } from "@/lib/ledger/flows/submissions";
import { cancelDisputeWindow } from "@/lib/queue/auto-approve-queue";
import { refuseDemoAdmin } from "@/lib/roles";
import { withRequestLogging } from "@/lib/with-request-logging";

/**
 * The worker accepts a rejection, so the held reward goes back to the task and
 * the slot reopens right away instead of waiting for the window to end.
 * Only the submission's own worker may do it.
 */
export const POST = withRequestLogging(
  "/api/v1/submissions/[id]/accept-rejection",
  async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const session = await auth();
    if (!session || session.user.role !== "worker") {
      const demo = refuseDemoAdmin(session);
      if (demo) return demo;
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.isValidObjectId(id))
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await connectDB();
    const own = await Submission.exists({ _id: id, workerId: session.user.id, status: "rejected" });
    if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const res = await settleRejection({ submissionId: id, via: "accepted" });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.reason === "buyer_missing" ? "The buyer's account no longer exists" : "This rejection is already final" },
        { status: res.reason === "buyer_missing" ? 409 : 404 },
      );
    }
    await cancelDisputeWindow(id);
    return NextResponse.json({ ok: true, outcome: res.outcome });
  },
);
