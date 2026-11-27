import { evaluateLinks, recordSighting } from "@/lib/fraud/signals";
import { requireApprovedWorker } from "@/lib/worker-verification";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import { withdrawalSchema } from "@/lib/validators/withdrawal";
import { logger } from "@/lib/logger";
import { sendWithdrawalConfirmationEmail } from "@/lib/email";
import { requestWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { workerWithdrawalView } from "@/lib/withdrawal-view";
import { consume, rateLimitedResponse } from "@/lib/ratelimit";
import { maskAccountFields, maskEmailFields } from "@/lib/privacy";
import { isAdminRole } from "@/lib/roles";
import { withRequestLogging } from "@/lib/with-request-logging";
import { withIdempotency } from "@/lib/idempotency";
import { mfaProblem, mfaResponse } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A worker sees their own withdrawals and an admin role sees all of them.
  // Anyone else (a buyer, say) must not see payout details.
  const isWorker = session.user.role === "worker";
  if (!isWorker && !isAdminRole(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isWorker) {
    const problem = await mfaProblem(session);
    if (problem) return mfaResponse(problem);
  }

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 10;

  const status = searchParams.get("status");
  const query: Record<string, unknown> = isWorker ? { workerId: session.user.id } : {};
  if (status && status !== "all") query.status = status;
  // The admin queue shows the riskiest requests first; everyone else sees the newest first.
  const sort = !isWorker && searchParams.get("sort") === "risk" ? "-riskScore createdAt" : "-createdAt";
  const [withdrawals, total] = await Promise.all([
    Withdrawal.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Withdrawal.countDocuments(query),
  ]);

  return NextResponse.json({
    withdrawals: maskAccountFields(
      maskEmailFields(
        isWorker
          ? withdrawals.map((w) => workerWithdrawalView({ toObject: () => w }))
          : withdrawals.map((w) => {
              const { confirmTokenHash, ...rest } = w as typeof w & { confirmTokenHash?: string };
              void confirmTokenHash;
              return rest;
            }),
        ["workerEmail"],
        session.user,
      ),
      ["accountNumber"],
      session.user,
    ),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export const POST = withRequestLogging("/api/v1/withdrawals", async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "worker") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const notApproved = await requireApprovedWorker(session.user.id);
  if (notApproved) return notApproved;

  await recordSighting(session.user.id, req.headers, "withdraw");
  await evaluateLinks(session.user.id);

  return withIdempotency(req, session.user.id, async () => {
    // Counted here, so a repeat of a request that already ran (a double click, a
    // retry) is answered from the stored response and does not use up the day's 3.
    const limit = await consume("withdraw", session.user.id);
    if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

    const body = await req.json();
    const parsed = withdrawalSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );

    await connectDB();
    const result = await requestWithdrawal({
      worker: {
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      },
      coins: parsed.data.coinRequested,
      paymentSystem: parsed.data.paymentSystem,
      accountNumber: parsed.data.accountNumber,
    });
    if (!result.ok) {
      const map = {
        below_minimum: ["Minimum 200 coins required", 400],
        insufficient_coins: ["Insufficient coins", 400],
        daily_limit: ["This is over the daily withdrawal limit", 422],
        weekly_limit: ["This is over the weekly withdrawal limit", 422],
        worker_missing: ["Unauthorized", 401],
      } as const;
      const [error, status] = map[result.reason];
      return NextResponse.json({ error }, { status });
    }

    // The link is only ever sent by email. If sending fails the worker can ask for another.
    const confirmUrl = `${process.env.NEXTAUTH_URL ?? ""}/worker/withdrawals/confirm?id=${result.withdrawal._id}&token=${result.confirmToken}`;
    let emailed = true;
    try {
      await sendWithdrawalConfirmationEmail(result.withdrawal.workerEmail, confirmUrl, {
        coins: result.withdrawal.coinRequested,
        paymentSystem: result.withdrawal.paymentSystem,
      });
    } catch (err) {
      emailed = false;
      logger.error({ err, withdrawalId: String(result.withdrawal._id) }, "withdrawal confirmation email failed");
    }
    return NextResponse.json({ ...workerWithdrawalView(result.withdrawal), emailed }, { status: 201 });
  });
});
