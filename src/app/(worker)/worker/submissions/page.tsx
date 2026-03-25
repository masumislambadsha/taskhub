"use client";
import { MdToll } from 'react-icons/md';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ISubmission } from "@/types";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/shared/EmptyState";
import { format } from "date-fns";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Button } from '@heroui/react';

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
          <Button
            variant="outline"
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`h-10 rounded-lg px-4 justify-between font-medium shadow-sm capitalize transition-all ${
              status === s
                ? "bg-primary text-white border-primary"
                : "bg-white border-primary/10 text-primary/60 hover:border-primary/20"
            }`}
          >
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable
        rows={6}
          cols={5}
          headers={["Task", "Buyer", "Payout", "Status", "Date"]}
        />
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
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {submissions.map((s) => (
              <div
                key={s._id}
                className="bg-white rounded-xl border border-primary/5 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="font-semibold text-primary text-sm leading-snug">
                    {s.taskTitle}
                  </p>
                  <Badge status={s.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-primary/50">
                  <span>{s.taskBuyerName}</span>
                  <span>{format(new Date(s.createdAt), "MMM d, yyyy")}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 font-semibold text-secondary text-sm">
                  <MdToll className="text-xs text-amber-500" />
                  <CountUp value={s.payableAmount} />
                  <span className="text-xs font-normal text-primary/40 ml-0.5">
                    coins
                  </span>
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
                    {["Task", "Buyer", "Payout", "Status", "Date"].map((h) => (
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
                          <MdToll className="text-xs text-amber-500" />
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
