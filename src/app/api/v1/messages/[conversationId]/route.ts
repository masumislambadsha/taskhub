import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isParticipant, parseConversationId } from "@/lib/conversation";
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
  if (!parseConversationId(conversationId)) {
    return NextResponse.json(
      { error: "Invalid conversation ID" },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  if (!isParticipant(conversationId, userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

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
