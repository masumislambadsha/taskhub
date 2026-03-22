"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ITask } from "@/types";
import Link from "next/link";

export default function TaskSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: task } = useQuery<ITask>({
    queryKey: ["task-success", id],
    queryFn: () => axios.get(`/api/v1/tasks/${id}`).then((r) => r.data),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Hero */}
      <div className="flex flex-col items-center text-center pt-4 pb-2">
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-secondary/10 rounded-full blur-3xl scale-150" />
          <div className="relative w-20 h-20 bg-secondary text-white rounded-full flex items-center justify-center shadow-xl shadow-secondary/20">
            <span
              className="material-symbols-outlined text-5xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-primary mb-3 tracking-tight">
          Your task is live!
        </h1>
        <p className="text-primary/60 text-base max-w-xl leading-relaxed">
          Workers have been notified. You've successfully posted a new
          opportunity on TaskHub.
        </p>
      </div>

      {/* Bento summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main details */}
        <div className="md:col-span-2 bg-white p-8 rounded-xl border border-primary/5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-secondary/5 rounded-bl-full -mr-6 -mt-6" />
          <div className="relative z-10">
            <span className="text-xs uppercase tracking-widest text-secondary font-bold mb-4 block">
              Task Identification
            </span>
            <h2 className="font-headline text-2xl font-bold text-primary mb-5">
              {task?.title ?? "—"}
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-primary/40 mb-1">
                  Status
                </p>
                <div className="flex items-center gap-2 text-secondary font-semibold text-sm">
                  <span className="w-2 h-2 bg-secondary rounded-full" />
                  Active &amp; Visible
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-primary/40 mb-1">
                  Category
                </p>
                <p className="text-primary font-semibold text-sm">
                  {task?.category || "General"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Budget card */}
        <div className="bg-primary text-white p-8 rounded-xl flex flex-col justify-between shadow-xl">
          <div>
            <span className="text-xs uppercase tracking-widest text-white/50 font-medium mb-6 block">
              Project Budget
            </span>
            <div className="mb-1">
              <span className="text-4xl font-headline font-extrabold">
                {task?.payableAmount ?? "—"}
              </span>
              <span className="text-white/60 text-sm ml-1">coins / worker</span>
            </div>
          </div>
          <div className="pt-6 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">
                Desired Workers
              </span>
              <span className="text-xl font-bold">
                {String(task?.requiredWorkers ?? "—").padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Next steps + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Next milestones */}
        <div className="lg:col-span-3 bg-white p-8 rounded-xl border border-primary/5 shadow-sm">
          <h3 className="font-headline text-lg font-bold text-primary mb-6">
            Next Milestones
          </h3>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-xl">group</span>
              </div>
              <div>
                <p className="font-bold text-primary text-sm">
                  Review Submissions
                </p>
                <p className="text-xs text-primary/50 mt-0.5">
                  Workers will start submitting soon. Review them from your
                  submissions page.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary/40">
                <span className="material-symbols-outlined text-xl">
                  rate_review
                </span>
              </div>
              <div>
                <p className="font-bold text-primary text-sm">
                  Approve or Reject
                </p>
                <p className="text-xs text-primary/50 mt-0.5">
                  Approve quality work to release coins, or reject with a reason
                  to maintain standards.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <Link
            href={`/buyer/tasks/${id}`}
            className="group w-full bg-secondary text-white h-14 rounded-xl flex items-center justify-center gap-3 font-headline font-bold text-base hover:bg-secondary/90 hover:shadow-lg hover:shadow-secondary/20 transition-all"
          >
            View Live Task
            <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </Link>
          <Link
            href="/buyer/tasks/new"
            className="w-full bg-primary/5 text-primary h-14 rounded-xl flex items-center justify-center gap-3 font-headline font-bold text-base hover:bg-primary/10 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add_task</span>
            Create Another Task
          </Link>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/buyer/tasks/${id}`,
              );
            }}
            className="w-full text-secondary font-semibold py-3 flex items-center justify-center gap-2 hover:bg-secondary/5 rounded-xl transition-colors text-sm"
          >
            <span className="material-symbols-outlined text-lg">share</span>
            Copy Task Link
          </button>
        </div>
      </div>

      {/* Floating ribbon */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200/60 px-6 py-2 rounded-full shadow-lg flex items-center gap-4 z-40">
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800">
          Task Mode: Live
        </span>
        <div className="h-4 w-px bg-amber-300" />
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-amber-700">
            bolt
          </span>
          <span className="text-xs font-semibold text-amber-800">
            Workers Notified
          </span>
        </div>
      </div>
    </div>
  );
}
