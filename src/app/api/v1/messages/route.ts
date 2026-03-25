import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Task from "@/models/Task";
import User from "@/models/User";

// GET /api/v1/messages — list conversations for current user
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const userId = session.user.id;

  // Get latest message per conversationId where user is sender or receiver
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          {
            senderId: {
              $eq: require("mongoose").Types.ObjectId.createFromHexString(
                userId,
              ),
            },
          },
          {
            receiverId: {
              $eq: require("mongoose").Types.ObjectId.createFromHexString(
                userId,
              ),
            },
          },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$conversationId",
        lastMessage: { $first: "$content" },
        lastMessageAt: { $first: "$createdAt" },
        taskId: { $first: "$taskId" },
        senderId: { $first: "$senderId" },
        receiverId: { $first: "$receiverId" },
        senderName: { $first: "$senderName" },
        receiverName: { $first: "$receiverName" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isRead", false] },
                  {
                    $ne: [
                      "$senderId",
                      require("mongoose").Types.ObjectId.createFromHexString(
                        userId,
                      ),
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { lastMessageAt: -1 } },
  ]);

  // Populate task titles + other user photos
  const taskIds = [...new Set(conversations.map((c) => c.taskId.toString()))];
  const tasks = await Task.find({ _id: { $in: taskIds } })
    .select("title buyerId buyerName")
    .lean();
  const taskMap = Object.fromEntries(tasks.map((t) => [t._id.toString(), t]));

  // Get photos for all other users
  const otherUserIds = conversations.map((c) => {
    const isSender = c.senderId.toString() === userId;
    return isSender ? c.receiverId.toString() : c.senderId.toString();
  });
  const users = await User.find({ _id: { $in: otherUserIds } })
    .select("_id photoUrl")
    .lean();
  const userPhotoMap = Object.fromEntries(
    users.map((u) => [u._id.toString(), u.photoUrl ?? null]),
  );

  const result = conversations.map((c) => {
    const task = taskMap[c.taskId.toString()];
    const isSender = c.senderId.toString() === userId;
    const otherUserId = isSender
      ? c.receiverId.toString()
      : c.senderId.toString();
    const otherUserName = isSender
      ? (c.receiverName ?? "Unknown")
      : c.senderName;

    return {
      conversationId: c._id,
      taskId: c.taskId.toString(),
      taskTitle: task?.title ?? "Unknown Task",
      otherUserId,
      otherUserName,
      otherUserPhoto: userPhotoMap[otherUserId] ?? null,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
    };
  });

  return NextResponse.json(result);
}
