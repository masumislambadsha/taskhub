import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const notifications = await Notification.find({ toUserId: session.user.id })
    .sort("-createdAt")
    .limit(20)
    .lean();

  return NextResponse.json(notifications);
}
