"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";

interface WalletItem {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
  taskId?: string;
  paymentId?: string;
  withdrawalId?: string;
  submissionId?: string;
}

const LABELS: Record<string, string> = {
  topup: "Coins purchased",
  signup_bonus: "Welcome bonus",
  task_fund: "Task funded",
  task_adjust: "Task budget changed",
  task_refund: "Task refund",
  submission_payout: "Task payout",
  submission_reject_refund: "Task refund",
  withdrawal: "Withdrawal",
  admin_adjustment: "Balance adjustment",
  forfeit: "Balance removed",
  reversal: "Correction",
};

function reference(item: WalletItem): string | null {
  const id = item.withdrawalId ?? item.paymentId ?? item.taskId ?? item.submissionId;
  if (!id) return null;
  const prefix = item.withdrawalId
    ? "WDR"
    : item.paymentId
      ? "PAY"
      : "Task";
  return `${prefix} #${id.slice(-6).toUpperCase()}`;
}

/** A short list of the signed-in user's latest coin movements, from the ledger. */
export default function RecentCoinActivity({ limit = 8 }: { limit?: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["wallet-transactions", limit],
    queryFn: () =>
      axios
        .get<{ items: WalletItem[] }>("/api/v1/wallet/transactions", {
          params: { limit },
        })
        .then((r) => r.data.items),
  });

  return (
    <div>
      <h2 className="font-headline text-xl font-bold text-primary">
        Recent coin activity
      </h2>
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm mt-3 divide-y divide-primary/5">
        {isLoading ? (
          <p className="p-5 text-sm text-primary/40">Loading…</p>
        ) : isError ? (
          <p className="p-5 text-sm text-primary/40">
            Could not load your coin activity.
          </p>
        ) : !data || data.length === 0 ? (
          <p className="p-5 text-sm text-primary/40">No coin activity yet.</p>
        ) : (
          data.map((item) => {
            const ref = reference(item);
            const positive = item.amount > 0;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">
                    {LABELS[item.type] ?? "Coin movement"}
                  </p>
                  <p className="text-xs text-primary/40">
                    {format(new Date(item.createdAt), "MMM d, yyyy")}
                    {ref ? ` · ${ref}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-bold font-headline text-sm ${positive ? "text-secondary" : "text-red-500"}`}
                >
                  {positive ? "+" : ""}
                  {item.amount} coins
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
