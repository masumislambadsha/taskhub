import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { removeUser } from "@/lib/ledger/flows/users";
import { USER_ROLES, requireAdmin } from "@/lib/roles";

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

  const user = await User.findByIdAndUpdate(id, update, { new: true }).select(
    "-passwordHash",
  );
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
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
  await removeUser({ userId: id, adminId: guard.userId });
  return NextResponse.json({ ok: true });
}
