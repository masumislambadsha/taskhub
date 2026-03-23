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
import { SkeletonTable } from "@/components/ui/Skeleton";

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

  const handleDelete = async (t: ITask) => {
    const result = await Swal.fire({
      title: "Delete Task?",
      text: `"${t.title}" will be permanently deleted and coins refunded.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      ...dangerTheme,
    });
    if (result.isConfirmed) deleteMutation.mutate(t._id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
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
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span className="hidden sm:inline">New Task</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {isLoading ? (
        <SkeletonTable
          rows={5}
          cols={6}
          headers={[
            "Title",
            "Status",
            "Workers",
            "Payout",
            "Deadline",
            "Actions",
          ]}
        />
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
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {tasks.map((t) => (
              <div
                key={t._id}
                className="bg-white rounded-xl border border-primary/5 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Link
                    href={`/buyer/tasks/${t._id}`}
                    className="font-semibold text-primary text-sm leading-snug hover:text-secondary transition-colors"
                  >
                    {t.title}
                  </Link>
                  <Badge status={t.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-primary/50 mb-3">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">
                      group
                    </span>
                    {t.filledWorkers}/{t.requiredWorkers} workers
                  </span>
                  <span>
                    {format(new Date(t.completionDate), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-semibold text-secondary text-sm">
                    <span
                      className="material-symbols-outlined text-xs text-amber-500"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      toll
                    </span>
                    <CountUp value={t.payableAmount} />
                    <span className="text-xs font-normal text-primary/40">
                      coins
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/buyer/tasks/${t._id}/edit`}
                      className="text-xs px-2.5 py-1 rounded-md bg-secondary/10 text-secondary font-semibold hover:bg-secondary/20 transition-colors"
                    >
                      Edit
                    </Link>
                    {t.status === "open" && (
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-primary/5">
                  <tr>
                    {[
                      "Title",
                      "Status",
                      "Workers",
                      "Payout",
                      "Deadline",
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
                  {tasks.map((t) => (
                    <tr
                      key={t._id}
                      className="hover:bg-background/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-primary max-w-xs truncate">
                        <Link
                          href={`/buyer/tasks/${t._id}`}
                          className="hover:text-secondary hover:underline transition-colors"
                        >
                          {t.title}
                        </Link>
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
                              onClick={() => handleDelete(t)}
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
          </div>
        </>
      )}

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
