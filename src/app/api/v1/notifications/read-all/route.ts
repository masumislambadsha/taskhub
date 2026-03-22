import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";

export async function POST() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  await Notification.updateMany(
    { toUserId: session.user.id, isRead: false },
    { isRead: true },
  );
  return NextResponse.json({ ok: true });
}
