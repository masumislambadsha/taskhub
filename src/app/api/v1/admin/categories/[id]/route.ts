import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import Category from "@/models/Category";
import { auditContextFrom, recordAudit } from "@/lib/audit";
import { inLedgerTransaction } from "@/lib/ledger/run";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requireAdmin(session, "write");
  if (!guard.ok) return guard.response;
  await connectDB();
  const { id } = await params;
  const audit = auditContextFrom(req, guard);
  const deleted = await inLedgerTransaction(async (session) => {
    const removed = await Category.findByIdAndDelete(id, { session });
    if (removed) {
      await recordAudit(
        audit,
        {
          action: "category.delete",
          targetType: "category",
          targetId: id,
          before: { name: removed.name, icon: removed.icon },
        },
        session,
      );
    }
    return removed;
  });
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requireAdmin(session, "write");
  if (!guard.ok) return guard.response;
  await connectDB();
  const { id } = await params;
  const { name, icon } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const audit = auditContextFrom(req, guard);
  const updated = await inLedgerTransaction(async (session) => {
    const before = await Category.findById(id).session(session).lean();
    if (!before) return null;
    const next = await Category.findByIdAndUpdate(
      id,
      { name: name.trim(), icon: icon ?? "category" },
      { returnDocument: "after", session },
    );
    await recordAudit(
      audit,
      {
        action: "category.update",
        targetType: "category",
        targetId: id,
        before: { name: before.name, icon: before.icon },
        after: { name: next?.name, icon: next?.icon },
      },
      session,
    );
    return next;
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ category: updated });
}
