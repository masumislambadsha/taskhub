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
          <div className="divide-y divide-primary/5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-primary/15 text-5xl">
              receipt_long
            </span>
            <p className="text-primary/40 text-sm">No payments found</p>
          </div>
        ) : (
          <>
            {/* ── Desktop table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-primary/5">
                  <tr>
                    {[
                      "User",
                      "Coins",
                      "Amount",
                      "Gateway",
                      "Status",
                      "Date",
                      "",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {payments.map((p) => (
                    <tr
                      key={p._id}
                      className="hover:bg-background/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-primary/70">
                        {p.userEmail}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 font-semibold text-primary">
                          <span
                            className="material-symbols-outlined text-xs text-amber-500"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            toll
                          </span>
                          <CountUp value={p.coinsPurchased} />
                        </div>
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
                      <td className="px-6 py-4 text-primary/50 whitespace-nowrap">
                        {format(new Date(p.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status === "pending" && (
                          <button
                            onClick={() => handleConfirm(p._id)}
                            disabled={confirming === p._id}
                            className="px-3 py-1.5 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                          >
                            {confirming === p._id ? "…" : "Confirm"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden divide-y divide-primary/5">
              {payments.map((p) => (
                <div
                  key={p._id}
                  className="px-4 py-4 space-y-2 hover:bg-background/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-secondary font-bold text-sm">
                      {p.userEmail?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary font-medium truncate">
                        {p.userEmail}
                      </p>
                      <p className="text-xs text-primary/40 capitalize">
                        {p.gateway} ·{" "}
                        {format(new Date(p.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge status={p.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pl-12">
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                      <span
                        className="material-symbols-outlined text-amber-500 text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        toll
                      </span>
                      <span className="text-xs font-bold text-primary">
                        <CountUp value={p.coinsPurchased} />
                      </span>
                    </div>
                    <div className="bg-secondary/10 px-2 py-1 rounded-lg">
                      <span className="text-xs font-extrabold text-secondary">
                        $<CountUp value={p.amount} decimals={2} />
                      </span>
                    </div>
                    {p.status === "pending" && (
                      <button
                        onClick={() => handleConfirm(p._id)}
                        disabled={confirming === p._id}
                        className="ml-auto px-3 py-1.5 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                      >
                        {confirming === p._id ? "…" : "Confirm"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-sm">
              chevron_left
            </span>
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${page === p ? "bg-primary text-white" : "bg-white border border-primary/10 text-primary hover:border-secondary"}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-sm">
              chevron_right
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
