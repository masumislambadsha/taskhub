"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { IPayment } from "@/types";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/shared/EmptyState";
import { format } from "date-fns";
import CountUp from "@/components/ui/CountUp";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function BuyerPaymentsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["buyer-payments", page],
    queryFn: () =>
      axios
        .get("/api/v1/payments/history", { params: { page } })
        .then((r) => r.data),
  });

  const payments: IPayment[] = data?.payments ?? [];
  const pages: number = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Payment History
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          All your coin purchase transactions
        </p>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <SkeletonTable
            rows={5}
            cols={5}
            headers={["Date", "Coins", "Amount", "Gateway", "Status"]}
          />
        ) : payments.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="No payments yet"
            description="Purchase coins to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Date
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Coins
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Gateway
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {payments.map((p) => (
                  <tr
                    key={p._id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-primary/60">
                      {format(new Date(p.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        <span
                          className="material-symbols-outlined text-xs text-amber-500"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          toll
                        </span>
                        <CountUp value={p.coinsPurchased} />
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-secondary">
                      $<CountUp value={p.amount} decimals={2} />
                    </td>
                    <td className="px-6 py-4 text-primary/60 capitalize">
                      {p.gateway}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${page === p ? "bg-primary text-white" : "bg-white border border-primary/10 text-primary hover:border-secondary"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
