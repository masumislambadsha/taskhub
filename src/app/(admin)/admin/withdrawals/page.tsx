"use client";

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
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <EmptyState
            icon="account_balance"
            title="No withdrawal requests"
            description="Pending requests will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Worker
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Coins
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Method
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Account
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Date
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {withdrawals.map((w) => (
                  <tr
                    key={w._id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-primary">
                        {w.workerName}
                      </div>
                      <div className="text-xs text-primary/50">
                        {w.workerEmail}
                      </div>
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
                    <td className="px-6 py-4 text-primary/60 max-w-xs truncate">
                      {w.accountNumber}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={w.status} />
                    </td>
                    <td className="px-6 py-4 text-primary/50">
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
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              const { value: reason, isConfirmed } =
                                await Swal.fire({
                                  title: "Reject Withdrawal",
                                  input: "textarea",
                                  inputLabel: "Reason for rejection (optional)",
                                  inputPlaceholder:
                                    "Tell the worker why their withdrawal was rejected…",
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
                            }}
                            disabled={actionMutation.isPending}
                            className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 disabled:opacity-60"
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
