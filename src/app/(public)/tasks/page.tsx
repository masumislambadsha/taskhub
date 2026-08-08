"use client";

import {
  MdClose,
  MdSearch,
  MdSort,
  MdToll,
} from "react-icons/md";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import CountUp from "@/components/ui/CountUp";
import { SkeletonTaskGrid } from "@/components/ui/Skeleton";

const SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest first" },
  { value: "-payableAmount", label: "Highest payout" },
  { value: "payableAmount", label: "Lowest payout" },
  { value: "completionDate", label: "Earliest deadline" },
];

interface TaskCardData {
  _id: string;
  title: string;
  details: string;
  buyerName: string;
  payableAmount: number;
  requiredWorkers: number;
  filledWorkers: number;
  completionDate: string;
  category?: string;
  imageUrl?: string;
  status: string;
}

export default function ExploreTasksPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minPayout, setMinPayout] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const limit = 9;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: categoryData } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () =>
      axios.get("/api/v1/categories").then((r) => r.data.categories),
    staleTime: 60 * 60 * 1000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "public-tasks",
      page,
      limit,
      debouncedSearch,
      category,
      minPayout,
      sort,
    ],
queryFn: () =>
      axios
        .get("/api/v1/tasks", {
          params: {
            page,
            limit,
            search: debouncedSearch || undefined,
            category: category || undefined,
            minPayout: minPayout ? Number(minPayout) : undefined,
            sort,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const tasks: TaskCardData[] = (data?.tasks ?? []) as TaskCardData[];
  const total: number = data?.total ?? 0;
  const pages: number = data?.pages ?? 1;

  const resetPage = () => setPage(1);

  const activeCategory = useMemo(
    () => categoryData?.find((c: { name: string }) => c.name === category),
    [category, categoryData],
  );

  const showFilters: {
    label: string;
    onClear: () => void;
  }[] = [
    ...(debouncedSearch
      ? [{ label: `"${debouncedSearch}"`, onClear: () => setSearch("") }]
      : []),
    ...(category
      ? [
          {
            label: activeCategory?.name ?? category,
            onClear: () => {
              setCategory("");
              resetPage();
            },
          },
        ]
      : []),
    ...(minPayout
      ? [
          {
            label: `≥ ${minPayout} coins`,
            onClear: () => {
              setMinPayout("");
              resetPage();
            },
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      <div className="mb-10">
        <span className="inline-block bg-secondary/10 text-secondary px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded mb-5">
          Explore the marketplace
        </span>
        <h1 className="font-headline text-4xl sm:text-5xl font-extrabold text-primary tracking-tight leading-tight">
          Find your next task
        </h1>
        <p className="text-primary/60 text-base font-light mt-3 max-w-2xl">
          Search, filter, and sort through open tasks posted by verified buyers.
          Every reward is shown before you apply — no surprises.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-4 md:p-5 mb-6 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 text-xl" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            type="search"
            placeholder="Search by task title…"
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary"
            aria-label="Search tasks"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 lg:gap-3">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              resetPage();
            }}
            className="px-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary text-sm"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {(categoryData ?? []).map((c: { name: string; icon?: string }) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={minPayout}
            onChange={(e) => {
              setMinPayout(e.target.value);
              resetPage();
            }}
            className="px-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary text-sm"
            aria-label="Filter by minimum payout"
          >
            <option value="">Any payout</option>
            <option value="5">≥ 5 coins</option>
            <option value="10">≥ 10 coins</option>
            <option value="25">≥ 25 coins</option>
            <option value="50">≥ 50 coins</option>
            <option value="100">≥ 100 coins</option>
          </select>

          <div className="flex items-center gap-2">
            <MdSort className="text-primary/30 shrink-0" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary text-sm"
              aria-label="Sort tasks"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-primary/40 font-semibold uppercase tracking-wider">
            Active:
          </span>
          {showFilters.map((f) => (
            <button
              key={f.label}
              onClick={f.onClear}
              className="flex items-center gap-1.5 text-xs font-semibold bg-secondary/10 text-secondary px-3 py-1.5 rounded-full hover:bg-secondary/20 transition-colors"
            >
              {f.label}
              <MdClose />
            </button>
          ))}
          <button
            onClick={() => {
              setSearch("");
              setCategory("");
              setMinPayout("");
              setPage(1);
            }}
            className="text-xs font-semibold text-primary/50 hover:text-primary underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-primary/50 mb-4">
        <span>
          {isLoading
            ? "Loading tasks…"
            : `${total.toLocaleString()} open task${total === 1 ? "" : "s"}`}
        </span>
        {isFetching && !isLoading && (
          <span className="animate-pulse">Updating…</span>
        )}
      </div>

      {isLoading ? (
        <SkeletonTaskGrid count={limit} />
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-16 text-center">
          <MdSearch className="text-5xl text-primary/15 mx-auto mb-4" />
          <p className="font-bold text-primary mb-1">No tasks found</p>
          <p className="text-primary/50 text-sm">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => {
            const remaining = task.requiredWorkers - task.filledWorkers;
            return (
              <Link
                key={task._id}
                href={`/tasks/${task._id}`}
                className="group bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6 flex flex-col gap-4 hover:border-secondary/40 hover:shadow-md transition-all h-full"
              >
                {task.imageUrl && (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden shrink-0 bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={task.imageUrl}
                      alt={task.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-primary leading-snug line-clamp-2 group-hover:text-secondary transition-colors">
                    {task.title}
                  </h3>
                  {task.category && (
                    <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                      {task.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-primary/45 line-clamp-2 font-light leading-relaxed -mt-2">
                  {task.details}
                </p>
                <div className="text-xs text-primary/50">by {task.buyerName}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 font-bold text-secondary">
                    <MdToll className="text-sm text-amber-500" />
                    <CountUp value={task.payableAmount} /> coins
                  </span>
                  <span className="text-xs text-primary/50">
                    <CountUp value={remaining} /> slot{remaining === 1 ? "" : "s"} left
                  </span>
                </div>
                <div className="text-[10px] text-primary/30 uppercase font-bold tracking-wider">
                  Deadline: {format(new Date(task.completionDate), "MMM d, yyyy")}
                </div>
                <span className="mt-auto block text-center bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors group-hover:scale-[0.98]">
                  View Details
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-10 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors"
          >
            ‹
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
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}