"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { IPayment } from "@/types";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";
import CountUp from "@/components/ui/CountUp";
import toast from "react-hot-toast";

export default function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function handleConfirm(paymentId: string) {
    setConfirming(paymentId);
    try {
      await axios.post("/api/v1/payments/admin-confirm", { paymentId });
      toast.success("Payment confirmed");
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch {
      toast.error("Failed to confirm payment");
    } finally {
      setConfirming(null);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", page],
    queryFn: () =>
      axios
        .get("/api/v1/payments/history", { params: { page } })
        .then((r) => r.data),
  });

  const payments: IPayment[] = data?.payments ?? [];
  const pages: number = data?.pages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Platform Payments
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          {total} total transactions
        </p>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    User
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
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Date
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {payments.map((p) => (
                  <tr
                    key={p._id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-primary/70">{p.userEmail}</td>
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
                    <td className="px-6 py-4 text-primary/50">
                      {format(new Date(p.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.status === "pending" && (
                        <button
                          onClick={() => handleConfirm(p._id)}
                          disabled={confirming === p._id}
                          className="px-3 py-1.5 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                        >
                          {confirming === p._id ? "..." : "Confirm"}
                        </button>
                      )}
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
