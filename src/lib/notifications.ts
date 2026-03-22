import { connectDB } from "./db";
import Notification from "@/models/Notification";

export async function createNotification({
  toUserId,
  toEmail,
  message,
  actionRoute,
  type = "info",
}: {
  toUserId: string;
  toEmail: string;
  message: string;
  actionRoute?: string;
  type?: "info" | "success" | "warning";
}) {
  await connectDB();
  return Notification.create({ toUserId, toEmail, message, actionRoute, type });
}
