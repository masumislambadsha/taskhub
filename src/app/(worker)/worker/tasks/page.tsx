"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ITask } from "@/types";
import { format } from "date-fns";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";
import { SkeletonTaskGrid } from "@/components/ui/Skeleton";

export default function WorkerTasksPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minPayout, setMinPayout] = useState(0);
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => axios.get("/api/v1/categories").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["worker-tasks", search, category, minPayout, sort, page],
    queryFn: () =>
      axios
        .get("/api/v1/tasks", {
          params: { search, category, minPayout, sort, page, limit: 12 },
        })
        .then((r) => r.data),
  });

  const tasks: ITask[] = data?.tasks ?? [];
  const pages: number = data?.pages ?? 1;
  const categories: { name: string; icon: string }[] =
    categoriesData?.categories ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Browse Tasks
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Find tasks that match your skills
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 flex flex-col sm:flex-row  gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search tasks…"
          className="flex-1 min-w-48 px-4 py-2.5 rounded-lg border border-primary/20 bg-background text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-lg border border-primary/20 bg-background text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={minPayout || ""}
          onChange={(e) => {
            setMinPayout(Number(e.target.value));
            setPage(1);
          }}
          placeholder="Min payout"
          className="w-full sm:w-32 px-4 py-2.5 rounded-lg border border-primary/20 bg-background text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-primary/20 bg-background text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="-createdAt">Newest</option>
          <option value="-payableAmount">Highest Payout</option>
          <option value="completionDate">Deadline Soon</option>
        </select>
      </div>

      {isLoading ? (
        <SkeletonTaskGrid count={6} />
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 text-primary/40">No tasks found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tasks.map((task) => (
            <div
              key={task._id}
              className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6 flex flex-col gap-3 hover:border-secondary/30 transition-colors"
            >
              {task.imageUrl && (
                <img
                  src={task.imageUrl}
                  alt={task.title}
                  className="w-full h-32 object-cover rounded-lg"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-primary text-lg leading-snug line-clamp-2">
                  {task.title}
                </h3>
                {task.category && (
                  <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">
                    {task.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-primary/50">by {task.buyerName}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 font-bold text-secondary">
                  <span
                    className="material-symbols-outlined text-sm text-amber-500"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    toll
                  </span>
                  <CountUp value={task.payableAmount} /> coins
                </span>
                <span className="text-xs text-primary/50">
                  <CountUp value={task.requiredWorkers - task.filledWorkers} />{" "}
                  slots left
                </span>
              </div>
              <p className="text-xs text-primary/40">
                Deadline: {format(new Date(task.completionDate), "MMM d, yyyy")}
              </p>
              <Link
                href={`/worker/tasks/${task._id}`}
                className="mt-auto block text-center bg-primary text-white py-2.5 rounded-lg sm:text-sm font-semibold hover:bg-primary/90 transition-colors text-xs "
              >
                View Details
              </Link>
            </div>
          ))}
        </div>
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
