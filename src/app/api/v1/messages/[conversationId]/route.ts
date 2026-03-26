import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import mongoose from "mongoose";

interface Props {
  params: Promise<{ conversationId: string }>;
}


export async function GET(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  await connectDB();

  const userId = session.user.id;

  
  const sample = await Message.findOne({ conversationId }).lean();
  if (
    sample &&
    sample.senderId.toString() !== userId &&
    sample.receiverId.toString() !== userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await Message.find({ conversationId })
    .sort("createdAt")
    .lean();

  
  await Message.updateMany(
    {
      conversationId,
      receiverId: new mongoose.Types.ObjectId(userId),
      isRead: false,
    },
    { isRead: true },
  );

  return NextResponse.json(messages);
}
