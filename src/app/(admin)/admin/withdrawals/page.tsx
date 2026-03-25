"use client";
import { MdChevronLeft, MdChevronRight, MdToll } from "react-icons/md";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { IWithdrawal } from "@/types";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/shared/EmptyState";
import { format } from "date-fns";
import toast from "react-hot-toast";
import CountUp from "@/components/ui/CountUp";
import Swal from "sweetalert2";

export default function AdminWithdrawalsPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", page],
    queryFn: () =>
      axios
        .get("/api/v1/withdrawals", { params: { page } })
        .then((r) => r.data),
  });

  const withdrawals: IWithdrawal[] = data?.withdrawals ?? [];
  const pages: number = data?.pages ?? 1;

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: string;
      reason?: string;
    }) => axios.patch(`/api/v1/withdrawals/${id}/approve`, { action, reason }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === "approve"
          ? "Withdrawal approved!"
          : "Withdrawal rejected",
      );
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : "Action failed";
      toast.error(typeof msg === "string" ? msg : "Action failed");
    },
  });

  async function handleReject(w: IWithdrawal) {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: "Reject Withdrawal",
      input: "textarea",
      inputLabel: "Reason for rejection (optional)",
      inputPlaceholder: "Tell the worker why their withdrawal was rejected…",
      inputAttributes: { rows: "3" },
      showCancelButton: true,
      confirmButtonText: "Reject",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#004030",
    });
    if (!isConfirmed) return;
    actionMutation.mutate({
      id: w._id,
      action: "reject",
      reason: reason || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Manage Withdrawals
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Process pending worker withdrawal requests
        </p>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-primary/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <EmptyState
            icon="account_balance"
            title="No withdrawal requests"
            description="Pending requests will appear here."
          />
        ) : (
          <>
            {/* ── Desktop table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-primary/5">
                  <tr>
                    {[
                      "Worker",
                      "Coins",
                      "Amount",
                      "Method",
                      "Account",
                      "Status",
                      "Date",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {withdrawals.map((w) => (
                    <tr
                      key={w._id}
                      className="hover:bg-background/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-primary">
                          {w.workerName}
                        </p>
                        <p className="text-xs text-primary/40">
                          {w.workerEmail}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-semibold text-primary">
                        <CountUp value={w.coinRequested} />
                      </td>
                      <td className="px-6 py-4 font-semibold text-secondary">
                        $<CountUp value={w.amount} decimals={2} />
                      </td>
                      <td className="px-6 py-4 text-primary/60 capitalize">
                        {w.paymentSystem}
                      </td>
                      <td className="px-6 py-4 text-primary/60 font-mono max-w-[120px] truncate">
                        {w.accountNumber}
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={w.status} />
                      </td>
                      <td className="px-6 py-4 text-primary/40 text-xs whitespace-nowrap">
                        {format(new Date(w.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4">
                        {w.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                actionMutation.mutate({
                                  id: w._id,
                                  action: "approve",
                                })
                              }
                              disabled={actionMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(w)}
                              disabled={actionMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden divide-y divide-primary/5">
              {withdrawals.map((w) => (
                <div
                  key={w._id}
                  className="px-4 py-4 space-y-3 hover:bg-background/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-secondary font-bold text-sm">
                      {w.workerName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary text-sm truncate">
                        {w.workerName}
                      </p>
                      <p className="text-xs text-primary/40 truncate">
                        {w.workerEmail}
                      </p>
                    </div>
                    <Badge status={w.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-12">
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                      <MdToll className="text-sm text-amber-500" />
                      <span className="text-xs font-bold text-primary">
                        <CountUp value={w.coinRequested} />
                      </span>
                    </div>
                    <div className="bg-secondary/10 px-2 py-1 rounded-lg">
                      <span className="text-xs font-extrabold text-secondary">
                        $<CountUp value={w.amount} decimals={2} />
                      </span>
                    </div>
                    <span className="text-xs text-primary/50 capitalize">
                      {w.paymentSystem}
                    </span>
                    <span className="text-xs text-primary/30">
                      {format(new Date(w.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  {w.status === "pending" && (
                    <div className="flex gap-2 pl-12">
                      <button
                        onClick={() =>
                          actionMutation.mutate({
                            id: w._id,
                            action: "approve",
                          })
                        }
                        disabled={actionMutation.isPending}
                        className="flex-1 text-xs py-1.5 rounded-lg font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(w)}
                        disabled={actionMutation.isPending}
                        className="flex-1 text-xs py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors flex items-center justify-center"
          >
            <MdChevronLeft className="text-xl" />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                page === p
                  ? "bg-primary text-white"
                  : "bg-white border border-primary/10 text-primary hover:border-secondary"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors flex items-center justify-center"
          >
            <MdChevronRight className="text-xl" />
          </button>
        </div>
      )}
    </div>
  );
}
