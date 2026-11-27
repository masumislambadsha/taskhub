import type { IWithdrawal } from "@/types";

const COLOR = {
  review: "text-amber-700",
  hold: "text-orange-700",
  high: "text-red-700 font-semibold",
} as const;

/** The reasons an admin should look twice at a withdrawal, with its score. */
export default function RiskReasons({ withdrawal }: { withdrawal: IWithdrawal }) {
  const flags = withdrawal.riskFlags ?? [];
  if (!flags.length) return <p className="mt-1 text-[11px] text-primary/40">No risk flags</p>;
  return (
    <div className="mt-1 space-y-0.5 max-w-[260px]">
      <p className="text-[11px] font-semibold text-primary/70">Risk score {withdrawal.riskScore ?? 0}</p>
      {flags.map((f) => (
        <p key={f.code} className={`text-[11px] leading-snug ${COLOR[f.level]}`}>
          {f.message}
        </p>
      ))}
    </div>
  );
}
