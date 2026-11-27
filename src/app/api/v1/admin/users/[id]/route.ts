import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { removeUser } from "@/lib/ledger/flows/users";
import { USER_ROLES, requireAdmin } from "@/lib/roles";
import { auditContextFrom, recordAudit } from "@/lib/audit";
import { inLedgerTransaction } from "@/lib/ledger/run";

const USER_STATUSES = ["active", "suspended"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requireAdmin(session, "write");
  if (!guard.ok) return guard.response;

  let body: { role?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { role, status } = body ?? {};

  if (
    role !== undefined &&
    !(typeof role === "string" && (USER_ROLES as readonly string[]).includes(role))
  ) {
    return NextResponse.json(
      { error: `role must be one of: ${USER_ROLES.join(", ")}` },
      { status: 400 },
    );
  }
  if (
    status !== undefined &&
    !(typeof status === "string" && (USER_STATUSES as readonly string[]).includes(status))
  ) {
    return NextResponse.json(
      { error: `status must be one of: ${USER_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }
  if (role === undefined && status === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { id } = await params;
  // The only admin must not be able to lock themselves out.
  if (id === guard.userId) {
    return NextResponse.json(
      { error: "You cannot change your own role or status" },
      { status: 400 },
    );
  }

  await connectDB();
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (role !== undefined) update.role = role;
  if (status !== undefined) update.status = status;

  // The change and its audit entries commit together.
  const audit = auditContextFrom(req, guard);
  const user = await inLedgerTransaction(async (session) => {
    const before = await User.findById(id).select("role status email").session(session).lean();
    if (!before) return null;
    const updated = await User.findByIdAndUpdate(id, update, {
      returnDocument: "after",
      session,
    }).select("-passwordHash");

    if (role !== undefined && role !== before.role) {
      await recordAudit(
        audit,
        {
          action: "user.role_change",
          targetType: "user",
          targetId: id,
          before: { role: before.role },
          after: { role },
        },
        session,
      );
    }
    if (status !== undefined && status !== before.status) {
      await recordAudit(
        audit,
        {
          action: status === "suspended" ? "user.suspend" : "user.unsuspend",
          targetType: "user",
          targetId: id,
          before: { status: before.status },
          after: { status },
        },
        session,
      );
    }
    return updated;
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(user);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requireAdmin(session, "write");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (id === guard.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  await connectDB();
  await removeUser({
    userId: id,
    adminId: guard.userId,
    audit: auditContextFrom(req, guard),
  });
  return NextResponse.json({ ok: true });
}
