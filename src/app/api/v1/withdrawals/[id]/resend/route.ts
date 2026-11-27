import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { reissueConfirmation } from "@/lib/ledger/flows/withdrawals";
import { sendWithdrawalConfirmationEmail } from "@/lib/email";
import { consume, rateLimitedResponse } from "@/lib/ratelimit";
import { refuseDemoAdmin } from "@/lib/roles";
import { withRequestLogging } from "@/lib/with-request-logging";

/** Sends a fresh confirmation link (the old one stops working). Limited to 3 a minute. */
export const POST = withRequestLogging(
  "/api/v1/withdrawals/[id]/resend",
  async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const demo = refuseDemoAdmin(session);
    if (demo) return demo;
    if (!session || session.user.role !== "worker")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = await consume("withdraw_resend", session.user.id);
    if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

    await connectDB();
    const { id } = await params;
    const res = await reissueConfirmation({ withdrawalId: id, workerId: session.user.id });
    if (!res.ok) return NextResponse.json({ error: "Not found, or already confirmed" }, { status: 404 });

    const url = `${process.env.NEXTAUTH_URL ?? ""}/worker/withdrawals/confirm?id=${id}&token=${res.confirmToken}`;
    try {
      await sendWithdrawalConfirmationEmail(res.withdrawal.workerEmail, url, {
        coins: res.withdrawal.coinRequested,
        paymentSystem: res.withdrawal.paymentSystem,
      });
    } catch {
      return NextResponse.json({ error: "Could not send the email. Try again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  },
);
