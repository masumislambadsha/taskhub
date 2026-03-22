"use client";

import CountUp from "@/components/ui/CountUp";

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

  return (
    <div
      className={`rounded-xl p-6 shadow-sm border ${
        accent
          ? "bg-primary text-white border-primary"
          : "bg-white border-primary/5"
      }`}
    >
      {icon && (
        <span
          className={`material-symbols-outlined text-3xl mb-3 block text-secondary`}
        >
          {icon}
        </span>
      )}
      <div
        className={`text-3xl font-bold font-headline ${accent ? "text-white" : "text-primary"}`}
      >
        {isNumber ? <CountUp value={value as number} /> : value}
      </div>
      <div
        className={`text-sm mt-1 ${accent ? "text-white/70" : "text-primary/60"}`}
      >
        {label}
      </div>
      {sub && (
        <div
          className={`text-xs mt-1 ${accent ? "text-secondary" : "text-secondary"}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
