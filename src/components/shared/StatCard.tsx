"use client";

import CountUp from "@/components/ui/CountUp";
import { IconType } from "react-icons";
import {
  MdAccountBalance,
  MdAnalytics,
  MdAssignment,
  MdAssignmentTurnedIn,
  MdCancel,
  MdCategory,
  MdCheckCircle,
  MdDashboard,
  MdGroup,
  MdPending,
  MdPayments,
  MdReceiptLong,
  MdRateReview,
  MdTask,
  MdTaskAlt,
  MdToll,
  MdBusinessCenter,
} from "react-icons/md";

const ICON_MAP: Record<string, IconType> = {
  dashboard: MdDashboard,
  group: MdGroup,
  task: MdTask,
  toll: MdToll,
  payments: MdPayments,
  assignment: MdAssignment,
  analytics: MdAnalytics,
  category: MdCategory,
  receipt_long: MdReceiptLong,
  account_balance: MdAccountBalance,
  task_alt: MdTaskAlt,
  assignment_turned_in: MdAssignmentTurnedIn,
  check_circle: MdCheckCircle,
  pending: MdPending,
  cancel: MdCancel,
  rate_review: MdRateReview,
  business_center: MdBusinessCenter,
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({
  label,
  value,
  icon,
  sub,
  accent,
}: StatCardProps) {
  const isNumber = typeof value === "number";
  const Icon = icon ? ICON_MAP[icon] : null;

  return (
    <div
      className={`rounded-xl p-4 sm:p-6 shadow-sm border ${
        accent
          ? "bg-primary text-white border-primary"
          : "bg-white border-primary/5"
      }`}
    >
      {Icon && <Icon className="text-3xl mb-3 block text-secondary" />}
      <div
        className={`text-2xl text-wrap sm:text-3xl font-bold font-headline ${accent ? "text-white" : "text-primary"}`}
      >
        {isNumber ? <CountUp value={value as number} /> : value}
      </div>
      <div
        className={`text-xs sm:text-sm mt-1 ${accent ? "text-white/70" : "text-primary/60"}`}
      >
        {label}
      </div>
      {sub && <div className="text-xs mt-1 text-secondary">{sub}</div>}
    </div>
  );
}
