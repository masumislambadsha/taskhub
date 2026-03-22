"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ISubmission } from "@/types";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/shared/EmptyState";
import { format } from "date-fns";
import toast from "react-hot-toast";
import CountUp from "@/components/ui/CountUp";
import Swal from "sweetalert2";

export default function BuyerSubmissionsPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ISubmission | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["buyer-submissions", page],
    queryFn: () =>
      axios
        .get("/api/v1/submissions", { params: { status: "pending", page } })
        .then((r) => r.data),
  });

  const submissions: ISubmission[] = data?.submissions ?? [];
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
    }) => axios.patch(`/api/v1/submissions/${id}/status`, { action, reason }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === "approve"
          ? "Submission approved!"
          : "Submission rejected",
      );
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["buyer-submissions"] });
    },
    onError: () => toast.error("Action failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Review Submissions
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Approve or reject pending worker submissions
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
        ) : submissions.length === 0 ? (
          <EmptyState
            icon="rate_review"
            title="No pending submissions"
            description="All caught up! New submissions will appear here."
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
                    Task
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Payout
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Submitted
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {submissions.map((s) => (
                  <tr
                    key={s._id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-primary">
                      {s.workerName}
                    </td>
                    <td className="px-6 py-4 text-primary/60 max-w-xs truncate">
                      {s.taskTitle}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-secondary font-semibold">
                        <span
                          className="material-symbols-outlined text-xs text-amber-500"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          toll
                        </span>
                        {s.payableAmount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-primary/50">
                      {format(new Date(s.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelected(s)}
                        className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Review
                      </button>
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

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-primary text-lg">
                Submission Details
              </h3>
              <button
                onClick={() => {
                  setSelected(null);
                }}
                className="text-primary/40 hover:text-primary"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-primary">Task:</span>{" "}
                <span className="text-primary/70">{selected.taskTitle}</span>
              </div>
              <div>
                <span className="font-medium text-primary">Worker:</span>{" "}
                <span className="text-primary/70">{selected.workerName}</span>
              </div>
              <div>
                <span className="font-medium text-primary">Details:</span>
                <p className="text-primary/70 mt-1 whitespace-pre-wrap">
                  {selected.details}
                </p>
              </div>
              {selected.proofLinks && selected.proofLinks.length > 0 && (
                <div>
                  <span className="font-medium text-primary">Proof Links:</span>
                  <ul className="mt-1 space-y-1">
                    {selected.proofLinks.map((l, i) => (
                      <li key={i}>
                        <a
                          href={l}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-secondary hover:underline break-all"
                        >
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.proofImageUrl && (
                <div>
                  <span className="font-medium text-primary">Proof Image:</span>
                  <img
                    src={selected.proofImageUrl}
                    alt="proof"
                    className="mt-2 rounded-lg max-h-48 object-cover"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() =>
                  actionMutation.mutate({ id: selected._id, action: "approve" })
                }
                disabled={actionMutation.isPending}
                className="flex-1 bg-secondary text-white py-2.5 rounded-lg font-semibold hover:bg-secondary/90 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                onClick={async () => {
                  const { value: reason, isConfirmed } = await Swal.fire({
                    title: "Reject Submission",
                    input: "textarea",
                    inputLabel: "Reason for rejection (optional)",
                    inputPlaceholder:
                      "Tell the worker why their submission was rejected…",
                    inputAttributes: { rows: "3" },
                    showCancelButton: true,
                    confirmButtonText: "Reject",
                    cancelButtonText: "Cancel",
                    confirmButtonColor: "#dc2626",
                    cancelButtonColor: "#004030",
                  });
                  if (!isConfirmed) return;
                  actionMutation.mutate({
                    id: selected._id,
                    action: "reject",
                    reason: reason || undefined,
                  });
                }}
                disabled={actionMutation.isPending}
                className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-lg font-semibold hover:bg-red-100 disabled:opacity-60 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
