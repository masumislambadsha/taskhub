export type UserRole = "worker" | "buyer" | "admin";
export type UserStatus = "active" | "suspended";
export type TaskStatus = "open" | "closed" | "blocked" | "archived";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "pending" | "success" | "failed";
export type PaymentGateway = "stripe" | "bkash" | "sslcommerz";
export type WithdrawalStatus = "pending" | "approved" | "rejected";
export type NotificationType = "info" | "success" | "warning";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: UserRole;
  coins: number;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ITask {
  _id: string;
  title: string;
  details: string;
  category?: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  requiredWorkers: number;
  filledWorkers: number;
  remainingWorkers: number;
  payableAmount: number;
  completionDate: string;
  submissionInfo: string;
  imageUrl?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ISubmission {
  _id: string;
  taskId: string;
  taskTitle: string;
  taskBuyerId: string;
  taskBuyerName: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  payableAmount: number;
  details: string;
  proofLinks?: string[];
  proofImageUrl?: string;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IPayment {
  _id: string;
  userId: string;
  userEmail: string;
  gateway: PaymentGateway;
  coinsPurchased: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gatewayTransactionId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IWithdrawal {
  _id: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  coinRequested: number;
  amount: number;
  paymentSystem: string;
  accountNumber: string;
  status: WithdrawalStatus;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface INotification {
  _id: string;
  toUserId: string;
  toEmail: string;
  message: string;
  actionRoute?: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface CoinPackage {
  id: string;
  coins: number;
  price: number;
  label: string;
  popular?: boolean;
}

export interface IMessage {
  _id: string;
  conversationId: string;
  taskId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  senderPhoto?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface IConversation {
  conversationId: string;
  taskId: string;
  taskTitle: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
