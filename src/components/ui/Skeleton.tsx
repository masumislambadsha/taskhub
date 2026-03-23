"use client";

// Base shimmer atom
function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-primary/8 ${className}`}
      style={{ background: "rgba(0,64,48,0.07)" }}
    />
  );
}

// ── Reusable primitives ──────────────────────────────────────────────────────

export function SkeletonText({ className = "" }: { className?: string }) {
  return <Bone className={`h-4 ${className}`} />;
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-14 h-14" }[size];
  return <Bone className={`${s} rounded-full`} />;
}

export function SkeletonBadge() {
  return <Bone className="h-5 w-16 rounded-full" />;
}

export function SkeletonButton({ className = "" }: { className?: string }) {
  return <Bone className={`h-10 rounded-lg ${className}`} />;
}

// ── Stat card ────────────────────────────────────────────────────────────────
export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-24" />
        <Bone className="w-9 h-9 rounded-lg" />
      </div>
      <Bone className="h-8 w-20" />
      <Bone className="h-3 w-16" />
    </div>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  const widths = ["w-40", "w-28", "w-16", "w-20", "w-24", "w-20"];
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Bone className={`h-4 ${widths[i % widths.length]}`} />
        </td>
      ))}
    </tr>
  );
}

// ── Full table ───────────────────────────────────────────────────────────────
export function SkeletonTable({
  rows = 6,
  cols = 5,
  headers,
}: {
  rows?: number;
  cols?: number;
  headers?: string[];
}) {
  return (
    <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background border-b border-primary/5">
            <tr>
              {(
                headers ?? Array.from({ length: cols }, (_, i) => String(i))
              ).map((h, i) => (
                <th key={i} className="text-left px-6 py-3">
                  {headers ? (
                    <span className="text-xs font-bold uppercase tracking-wider text-primary/50">
                      {h}
                    </span>
                  ) : (
                    <Bone className="h-3 w-16" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonTableRow key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Task card ────────────────────────────────────────────────────────────────
export function SkeletonTaskCard() {
  return (
    <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6 flex flex-col gap-3">
      <Bone className="w-full h-32 rounded-lg" />
      <div className="flex items-start justify-between gap-2">
        <Bone className="h-4 w-3/4" />
        <SkeletonBadge />
      </div>
      <Bone className="h-3 w-24" />
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-20" />
        <Bone className="h-3 w-16" />
      </div>
      <Bone className="h-3 w-32" />
      <Bone className="h-10 w-full rounded-lg mt-auto" />
    </div>
  );
}

// ── Task card grid ───────────────────────────────────────────────────────────
export function SkeletonTaskGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTaskCard key={i} />
      ))}
    </div>
  );
}

// ── Bar chart ────────────────────────────────────────────────────────────────
export function SkeletonBarChart() {
  const heights = [35, 55, 80, 45, 90, 60, 40];
  return (
    <div className="flex items-end gap-2 h-32">
      {heights.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md overflow-hidden"
            style={{ height: 80 }}
          >
            <div
              className="w-full rounded-t-md animate-pulse"
              style={{ height: `${h}%`, background: "rgba(0,64,48,0.07)" }}
            />
          </div>
          <Bone className="h-2 w-5" />
        </div>
      ))}
    </div>
  );
}

// ── List row (used in dashboard panels) ─────────────────────────────────────
export function SkeletonListRow() {
  return (
    <div className="px-6 py-3.5 flex items-center justify-between gap-4">
      <div className="space-y-1.5 flex-1">
        <Bone className="h-4 w-48" />
        <Bone className="h-3 w-28" />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Bone className="h-4 w-12" />
        <SkeletonBadge />
      </div>
    </div>
  );
}

// ── Panel with list rows ─────────────────────────────────────────────────────
export function SkeletonListPanel({
  rows = 5,
  title,
}: {
  rows?: number;
  title?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-primary/5 shadow-sm">
      <div className="px-6 py-4 border-b border-primary/5 flex items-center justify-between">
        {title ? (
          <span className="font-bold text-primary">{title}</span>
        ) : (
          <Bone className="h-4 w-32" />
        )}
        <Bone className="h-3 w-12" />
      </div>
      <div className="divide-y divide-primary/5">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonListRow key={i} />
        ))}
      </div>
    </div>
  );
}

// ── Quick links sidebar ──────────────────────────────────────────────────────
export function SkeletonQuickLinks({ count = 4 }: { count?: number }) {
  return (
    <div className="bg-white rounded-xl border border-primary/5 shadow-sm divide-y divide-primary/5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Bone className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-28" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="w-4 h-4 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Withdrawal balance banner ────────────────────────────────────────────────
export function SkeletonBalanceBanner() {
  return (
    <div
      className="rounded-xl p-5 flex items-center justify-between"
      style={{ background: "rgba(0,64,48,0.08)" }}
    >
      <div className="space-y-2">
        <Bone className="h-3 w-28" />
        <Bone className="h-8 w-20" />
        <Bone className="h-3 w-24" />
      </div>
      <Bone className="h-10 w-32 rounded-lg" />
    </div>
  );
}

// ── Leaderboard podium ───────────────────────────────────────────────────────
export function SkeletonPodium() {
  return (
    <div className="grid grid-cols-3 gap-4 items-end">
      {[false, true, false].map((isFirst, i) => (
        <div
          key={i}
          className={`bg-white rounded-2xl border border-primary/5 shadow-md p-6 text-center ${isFirst ? "-mt-6 bg-primary/5" : ""}`}
        >
          <Bone className="h-8 w-8 rounded-full mx-auto mb-3" />
          <SkeletonAvatar size="lg" />
          <div className="mx-auto mt-3 space-y-1.5">
            <Bone className="h-4 w-24 mx-auto" />
            <Bone className="h-3 w-16 mx-auto" />
            <Bone className="h-5 w-20 mx-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Leaderboard table row ────────────────────────────────────────────────────
export function SkeletonLeaderboardRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Bone className="w-8 h-4 rounded" />
      <SkeletonAvatar size="sm" />
      <div className="flex-1 space-y-1.5">
        <Bone className="h-4 w-32" />
        <Bone className="h-3 w-20" />
      </div>
      <div className="text-right space-y-1">
        <Bone className="h-4 w-24" />
        <Bone className="h-3 w-16" />
      </div>
    </div>
  );
}

// ── Page-level skeletons ─────────────────────────────────────────────────────

/** Worker & Buyer dashboard skeleton */
export function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      {/* header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Bone className="h-7 w-56" />
          <Bone className="h-4 w-36" />
        </div>
        <Bone className="h-10 w-36 rounded-xl" />
      </div>
      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      {/* middle row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-primary/5 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Bone className="h-5 w-40" />
              <Bone className="h-3 w-28" />
            </div>
            <Bone className="h-8 w-20" />
          </div>
          <SkeletonBarChart />
        </div>
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6 space-y-4">
          <Bone className="h-5 w-28" />
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Bone className="h-3 w-24" />
              <Bone className="h-3 w-10" />
            </div>
            <Bone className="h-2 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg p-3 text-center space-y-1.5"
                style={{ background: "rgba(0,64,48,0.04)" }}
              >
                <Bone className="h-6 w-12 mx-auto" />
                <Bone className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* bottom row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonListPanel rows={5} />
        </div>
        <div className="space-y-4">
          <SkeletonBalanceBanner />
          <SkeletonQuickLinks count={4} />
        </div>
      </div>
    </div>
  );
}

/** Admin dashboard skeleton */
export function SkeletonAdminDashboard() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Bone className="h-7 w-48" />
        <Bone className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <SkeletonListPanel rows={5} />
        <SkeletonListPanel rows={5} />
      </div>
    </div>
  );
}

/** Table page skeleton (submissions, payments, tasks, users, withdrawals) */
export function SkeletonTablePage({
  rows = 6,
  cols = 5,
  headers,
  filterCount = 2,
}: {
  rows?: number;
  cols?: number;
  headers?: string[];
  filterCount?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-7 w-44" />
        <Bone className="h-4 w-60" />
      </div>
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: filterCount }).map((_, i) => (
          <Bone key={i} className="h-10 w-32 rounded-lg" />
        ))}
      </div>
      <SkeletonTable rows={rows} cols={cols} headers={headers} />
    </div>
  );
}

/** Worker tasks page skeleton */
export function SkeletonWorkerTasksPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-7 w-36" />
        <Bone className="h-4 w-52" />
      </div>
      {/* filter bar */}
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 flex flex-wrap gap-3">
        <Bone className="flex-1 min-w-48 h-10 rounded-lg" />
        <Bone className="h-10 w-36 rounded-lg" />
        <Bone className="h-10 w-28 rounded-lg" />
        <Bone className="h-10 w-32 rounded-lg" />
      </div>
      <SkeletonTaskGrid count={6} />
    </div>
  );
}

/** Public tasks page skeleton */
export function SkeletonPublicTasksPage() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-16">
      <div className="mb-10 space-y-3">
        <Bone className="h-10 w-56" />
        <Bone className="h-5 w-80" />
      </div>
      <SkeletonTaskGrid count={6} />
    </div>
  );
}

/** Leaderboard page skeleton */
export function SkeletonLeaderboard() {
  return (
    <main className="pb-24">
      {/* hero */}
      <div className="bg-primary/10 py-20 px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <Bone className="h-4 w-24 mx-auto rounded-full" />
          <Bone className="h-14 w-72 mx-auto" />
          <Bone className="h-14 w-48 mx-auto" />
          <Bone className="h-4 w-96 mx-auto" />
        </div>
      </div>
      {/* podium */}
      <div className="max-w-3xl mx-auto px-8 -mt-6">
        <SkeletonPodium />
      </div>
      {/* table */}
      <div className="max-w-3xl mx-auto px-8 mt-12 space-y-4">
        <div className="flex items-center justify-between">
          <Bone className="h-5 w-32" />
          <Bone className="h-3 w-20" />
        </div>
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm overflow-hidden divide-y divide-primary/5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonLeaderboardRow key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}

/** Withdrawal page skeleton */
export function SkeletonWithdrawalPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-2">
        <Bone className="h-7 w-36" />
        <Bone className="h-4 w-56" />
      </div>
      <SkeletonBalanceBanner />
      {/* form card */}
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6 space-y-5">
        <Bone className="h-5 w-40" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bone className="h-3.5 w-28" />
              <Bone className="h-12 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Bone className="h-12 w-full rounded-lg" />
      </div>
      {/* history table */}
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}
