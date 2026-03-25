import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Task from "@/models/Task";
import Submission from "@/models/Submission";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const [user, tasksPosted, workersHired] = await Promise.all([
    User.findById(session.user.id).select("about").lean(),
    Task.countDocuments({ buyerId: session.user.id }),
    Submission.countDocuments({ taskBuyerId: session.user.id, status: "approved" }),
  ]);

  return NextResponse.json({
    about: (user as { about?: string })?.about ?? "",
    tasksPosted,
    workersHired,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, image, about } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();
  await User.findByIdAndUpdate(session.user.id, {
    ...(name && { name: name.trim() }),
    ...(image && { photoUrl: image }),
    ...(about !== undefined && { about: about.trim() }),
  });

  return NextResponse.json({ ok: true });
}
