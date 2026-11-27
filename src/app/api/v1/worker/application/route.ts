import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { workerStatusOf } from "@/lib/worker-verification";
import { MAX_APPLICATION_ATTEMPTS } from "@/models/WorkerApplication";
import WorkerApplication from "@/models/WorkerApplication";
import User from "@/models/User";

/** The worker's own application: status, what is filled in, and why it was rejected. Never returns file contents. */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "worker") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const [status, app, user] = await Promise.all([
    workerStatusOf(session.user.id),
    WorkerApplication.findOne({ userId: session.user.id }).lean(),
    User.findById(session.user.id).select("workerRejectionReason").lean(),
  ]);
  return NextResponse.json({
    status,
    attemptsLeft: Math.max(0, MAX_APPLICATION_ATTEMPTS - (app?.attempts ?? 0)),
    rejectionReason: status === "rejected" ? (user?.workerRejectionReason ?? app?.rejectionReason ?? null) : null,
    steps: {
      profile: app?.profile ?? null,
      payout: app?.payout ? { paymentSystem: app.payout.paymentSystem, accountNumber: app.payout.accountNumber } : null,
      skillsNote: app?.skillsNote ?? null,
      idDocument: Boolean(app?.idDocumentId),
      selfie: Boolean(app?.selfieId),
    },
  });
}
