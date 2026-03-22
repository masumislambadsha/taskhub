"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ITask } from "@/types";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/shared/EmptyState";
import { format } from "date-fns";
import Link from "next/link";
import toast from "react-hot-toast";
import CountUp from "@/components/ui/CountUp";
import Swal from "sweetalert2";

const dangerTheme = {
  confirmButtonColor: "#dc2626",
  cancelButtonColor: "#004030",
};

export default function BuyerTasksPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["buyer-tasks", page],
    queryFn: () =>
      axios
        .get("/api/v1/tasks", { params: { page, limit: 10, buyerOnly: true } })
        .then((r) => r.data),
  });

  const tasks: ITask[] = data?.tasks ?? [];
  const pages: number = data?.pages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/tasks/${id}`),
    onSuccess: () => {
      toast.success("Task deleted. Coins refunded.");
      qc.invalidateQueries({ queryKey: ["buyer-tasks"] });
    },
    onError: () => toast.error("Could not delete task"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            My Tasks
          </h1>
          <p className="text-primary/60 text-sm mt-1">
            Manage all your posted tasks
          </p>
        </div>
        <Link
          href="/buyer/tasks/new"
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">add</span> New
          Task
        </Link>
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
        ) : tasks.length === 0 ? (
          <EmptyState
            icon="task"
            title="No tasks yet"
            description="Post your first task to get work done."
            action={
              <Link
                href="/buyer/tasks/new"
                className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold"
              >
                Post a Task
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Title
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Workers
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Payout
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Deadline
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {tasks.map((t) => (
                  <tr
                    key={t._id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-primary max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={t.status} />
                    </td>
                    <td className="px-6 py-4 text-primary/60">
                      {t.filledWorkers}/{t.requiredWorkers}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-secondary font-semibold">
                        <span
                          className="material-symbols-outlined text-xs text-amber-500"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          toll
                        </span>
                        <CountUp value={t.payableAmount} />
                      </span>
                    </td>
                    <td className="px-6 py-4 text-primary/50">
                      {format(new Date(t.completionDate), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/buyer/tasks/${t._id}/edit`}
                          className="text-xs px-2.5 py-1 rounded-md bg-secondary/10 text-secondary font-semibold hover:bg-secondary/20 transition-colors"
                        >
                          Edit
                        </Link>
                        {t.status === "open" && (
                          <button
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: "Delete Task?",
                                text: `"${t.title}" will be permanently deleted and coins refunded.`,
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: "Yes, delete",
                                cancelButtonText: "Cancel",
                                ...dangerTheme,
                              });
                              if (result.isConfirmed) {
                                deleteMutation.mutate(t._id);
                              }
                            }}
                            className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
