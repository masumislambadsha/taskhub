import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getWalletHistory, InvalidCursorError } from "@/lib/ledger/history";

/**
 * The signed-in user's own coin history, newest first. Query: `limit`
 * (default 20, max 50) and `cursor` (the `nextCursor` of the previous page).
 * Returns `{ items: [{ id, type, amount, createdAt, taskId?, paymentId?,
 * withdrawalId?, submissionId? }], nextCursor }`.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam === null ? undefined : Number(limitParam);
  if (limit !== undefined && !Number.isFinite(limit))
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });

  await connectDB();
  try {
    const page = await getWalletHistory(session.user.id, {
      limit,
      cursor: searchParams.get("cursor"),
    });
    return NextResponse.json(page);
  } catch (err) {
    if (err instanceof InvalidCursorError)
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    throw err;
  }
}
