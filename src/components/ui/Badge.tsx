import {
  SubmissionStatus,
  WithdrawalStatus,
  TaskStatus,
  PaymentStatus,
} from "@/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  open: "bg-blue-100 text-blue-800",
  closed: "bg-gray-100 text-gray-700",
  blocked: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-500",
  success: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  active: "bg-green-100 text-green-800",
  suspended: "bg-red-100 text-red-800",
};

interface BadgeProps {
  status:
    | SubmissionStatus
    | WithdrawalStatus
    | TaskStatus
    | PaymentStatus
    | string;
  className?: string;
}

export default function Badge({ status, className = "" }: BadgeProps) {
  const color = statusColors[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${color} ${className}`}
    >
      {status}
    </span>
  );
}
