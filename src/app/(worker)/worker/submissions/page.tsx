"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ISubmission } from "@/types";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/shared/EmptyState";
import { format } from "date-fns";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";

export default function WorkerSubmissionsPage() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["worker-submissions", status, page],
    queryFn: () =>
      axios
        .get("/api/v1/submissions", { params: { status, page } })
        .then((r) => r.data),
  });

  const submissions: ISubmission[] = data?.submissions ?? [];
  const pages: number = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          My Submissions
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Track the status of all your submitted work
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${status === s ? "bg-primary text-white" : "bg-white border border-primary/10 text-primary hover:border-secondary"}`}
          >
            {s}
          </button>
        ))}
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
            icon="assignment"
            title="No submissions yet"
            description="Browse tasks and submit your work to start earning coins."
            action={
              <Link
                href="/worker/tasks"
                className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold"
              >
                Browse Tasks
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Task
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Buyer
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Payout
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {submissions.map((s) => (
                  <tr
                    key={s._id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-primary max-w-xs truncate">
                      {s.taskTitle}
                    </td>
                    <td className="px-6 py-4 text-primary/60">
                      {s.taskBuyerName}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 font-semibold text-secondary">
                        <span
                          className="material-symbols-outlined text-xs text-amber-500"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          toll
                        </span>
                        <CountUp value={s.payableAmount} />
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={s.status} />
                    </td>
                    <td className="px-6 py-4 text-primary/50">
                      {format(new Date(s.createdAt), "MMM d, yyyy")}
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
