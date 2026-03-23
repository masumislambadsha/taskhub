"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ITask } from "@/types";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import Image from "next/image";

export default function AdminTasksPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tasks", page, status],
    queryFn: () =>
      axios
        .get("/api/v1/admin/tasks", { params: { page, status } })
        .then((r) => r.data),
  });

  const tasks: ITask[] = data?.tasks ?? [];
  const pages: number = data?.pages ?? 1;
  const skeletonCount = tasks.length || 8;

  const blockMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      axios.patch("/api/v1/admin/tasks", { id, status: newStatus }),
    onError: () => toast.error("Update failed"),
  });

  const handleBlockToggle = (t: ITask) => {
    const isBlocked = t.status === "blocked";
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#4a9782",
      cancelButtonColor: "#004030",
      confirmButtonText: isBlocked ? "Yes, unblock it!" : "Yes, block it!",
    }).then((result) => {
      if (result.isConfirmed) {
        blockMutation.mutate(
          { id: t._id, newStatus: isBlocked ? "open" : "blocked" },
          {
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: ["admin-tasks"] });
              Swal.fire({
                title: isBlocked ? "Unblocked!" : "Blocked!",
                text: isBlocked
                  ? "The task has been unblocked."
                  : "The task has been blocked.",
                icon: "success",
              });
            },
          },
        );
      }
    });
  };

  const handleArchiveToggle = (t: ITask) => {
    const isArchived = t.status === "archived";
    Swal.fire({
      title: "Are you sure?",
      text: isArchived
        ? "This will restore the task to open."
        : "This will archive the task.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#4a9782",
      cancelButtonColor: "#004030",
      confirmButtonText: isArchived ? "Yes, unarchive it!" : "Yes, archive it!",
    }).then((result) => {
      if (result.isConfirmed) {
        blockMutation.mutate(
          { id: t._id, newStatus: isArchived ? "open" : "archived" },
          {
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: ["admin-tasks"] });
              Swal.fire({
                title: isArchived ? "Unarchived!" : "Archived!",
                text: isArchived
                  ? "The task has been restored."
                  : "The task has been archived.",
                icon: "success",
              });
            },
          },
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Manage Tasks
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Monitor and moderate all platform tasks
        </p>
      </div>

      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-lg border border-primary/20 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="blocked">Blocked</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  {[
                    "Title",
                    "Buyer",
                    "Status",
                    "Workers",
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
                {Array.from({ length: skeletonCount }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-10 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  {[
                    "Title",
                    "Buyer",
                    "Status",
                    "Workers",
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
                      {t.title}
                    </td>
                    <td className="px-6 py-4 text-primary/60">{t.buyerName}</td>
                    <td className="px-6 py-4">
                      <Badge status={t.status} />
                    </td>
                    <td className="px-6 py-4 text-primary/60">
                      {t.filledWorkers}/{t.requiredWorkers}
                    </td>
                    <td className="px-6 py-4 text-primary/50">
                      {format(new Date(t.completionDate), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`modal-${t._id}`}
                          className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/80 cursor-pointer transition-all duration-200"
                        >
                          Details
                        </label>
                        {t.status !== "blocked" ? (
                          <button
                            onClick={() => handleBlockToggle(t)}
                            className="text-xs transition-all duration-200  bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                          >
                            Block
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlockToggle(t)}
                            className="text-xs transition-all duration-200 bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                          >
                            Unblock
                          </button>
                        )}
                        {t.status !== "archived" ? (
                          <button
                            onClick={() => handleArchiveToggle(t)}
                            className="text-xs transition-all duration-200 bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveToggle(t)}
                            className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded hover:bg-secondary/20"
                          >
                            Unarchive
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
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                page === p
                  ? "bg-primary text-white"
                  : "bg-white border border-primary/10 text-primary hover:border-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* DaisyUI modals — one per task, rendered outside the table */}
      {tasks.map((t) => (
        <span key={t._id}>
          <input
            type="checkbox"
            id={`modal-${t._id}`}
            className="modal-toggle"
          />
          <div className="modal" role="dialog">
            <div className="modal-box bg-white max-w-lg p-0! overflow-hidden">
              {t.imageUrl && (
                <div className="relative w-full h-48 overflow-hidden">
                  <Image
                    src={t.imageUrl}
                    alt={t.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-headline text-xl font-bold text-primary leading-tight">
                    {t.title}
                  </h3>
                  <Badge status={t.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                      Buyer
                    </p>
                    <p className="text-primary font-medium">{t.buyerName}</p>
                    <p className="text-primary/50 text-xs">{t.buyerEmail}</p>
                  </div>
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                      Reward
                    </p>
                    <p className="text-primary font-medium">
                      {t.payableAmount} coins
                    </p>
                  </div>
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                      Workers
                    </p>
                    <p className="text-primary font-medium">
                      {t.filledWorkers} / {t.requiredWorkers}
                    </p>
                  </div>
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                      Deadline
                    </p>
                    <p className="text-primary font-medium">
                      {format(new Date(t.completionDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  {t.category && (
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                        Category
                      </p>
                      <p className="text-primary font-medium">{t.category}</p>
                    </div>
                  )}
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                      Created
                    </p>
                    <p className="text-primary font-medium">
                      {format(new Date(t.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                    Details
                  </p>
                  <p className="text-primary/80 text-sm leading-relaxed">
                    {t.details}
                  </p>
                </div>

                <div>
                  <p className="text-primary/50 text-xs uppercase font-semibold mb-1">
                    Submission Info
                  </p>
                  <p className="text-primary/80 text-sm leading-relaxed">
                    {t.submissionInfo}
                  </p>
                </div>

                <label
                  htmlFor={`modal-${t._id}`}
                  className="block w-full text-center py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Close
                </label>
              </div>
            </div>
            <label className="modal-backdrop" htmlFor={`modal-${t._id}`}>
              Close
            </label>
          </div>
        </span>
      ))}
    </div>
  );
}
