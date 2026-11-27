import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { mfaProblem, mfaResponse } from "@/lib/admin-guard";
import { maskEmailFields } from "@/lib/privacy";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isAdminRole(session.user.role)) {
    const problem = await mfaProblem(session);
    if (problem) return mfaResponse(problem);
  }

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 10;

  const query =
    isAdminRole(session.user.role) ? {} : { userId: session.user.id };
  const [payments, total] = await Promise.all([
    Payment.find(query)
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query),
  ]);

  return NextResponse.json({
    payments: maskEmailFields(payments, ["userEmail"], session.user),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
