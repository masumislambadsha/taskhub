import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { claimDispute } from "@/lib/ledger/flows/disputes";

/** Marks the dispute `under_review` by this admin, so two admins do not work the same one. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;
  await connectDB();
  const ok = await claimDispute({ disputeId: (await params).id, adminId: guard.userId });
  if (!ok) return NextResponse.json({ error: "Not found or already claimed" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
