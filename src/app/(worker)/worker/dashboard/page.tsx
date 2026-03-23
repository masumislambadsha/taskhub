import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import Withdrawal from "@/models/Withdrawal";
import mongoose from "mongoose";
import { coinsToUsdWithdraw } from "@/lib/coins";
import { format, subDays, startOfDay } from "date-fns";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/shared/StatCard";
import { MIN_WITHDRAWAL_COINS } from "@/lib/constants";

export default async function WorkerDashboard() {
  const session = await auth();
  await connectDB();

  const workerId = new mongoose.Types.ObjectId(session!.user.id);

  const [total, pending, approved, rejected] = await Promise.all([
    Submission.countDocuments({ workerId: session!.user.id }),
    Submission.countDocuments({
      workerId: session!.user.id,
      status: "pending",
    }),
    Submission.countDocuments({
      workerId: session!.user.id,
      status: "approved",
    }),
    Submission.countDocuments({
      workerId: session!.user.id,
      status: "rejected",
    }),
  ]);

  const [earningsAgg, pendingEarningsAgg, recentSubmissions] =
    await Promise.all([
      Submission.aggregate([
        { $match: { workerId, status: "approved" } },
        { $group: { _id: null, total: { $sum: "$payableAmount" } } },
      ]),
      Submission.aggregate([
        { $match: { workerId, status: "pending" } },
        { $group: { _id: null, total: { $sum: "$payableAmount" } } },
      ]),
      Submission.find({ workerId: session!.user.id })
        .sort("-createdAt")
        .limit(6)
        .lean(),
    ]);

  const totalEarnings = earningsAgg[0]?.total ?? 0;
  const pendingEarnings = pendingEarningsAgg[0]?.total ?? 0;
  const coins = session!.user.coins;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Last 7 days earnings per day
  const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
  const dailyEarnings = await Submission.aggregate([
    {
      $match: {
        workerId,
        status: "approved",
        updatedAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
        coins: { $sum: "$payableAmount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Build a full 7-day map
  const earningsMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const key = format(subDays(new Date(), i), "yyyy-MM-dd");
    earningsMap[key] = 0;
  }
  dailyEarnings.forEach((d) => {
    earningsMap[d._id] = d.coins;
  });
  const chartData = Object.entries(earningsMap).map(([date, coins]) => ({
    label: format(new Date(date + "T00:00:00"), "EEE"),
    coins,
  }));
  const maxCoins = Math.max(...chartData.map((d) => d.coins), 1);

  const canWithdraw = coins >= MIN_WITHDRAWAL_COINS;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            Welcome back, {session!.user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-primary/60 text-sm mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Link
          href="/worker/tasks"
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors w-full"
        >
          <span className="material-symbols-outlined text-sm ">search</span>
          Browse Tasks
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Submissions" value={total} icon="assignment" />
        <StatCard label="Approved" value={approved} icon="check_circle" />
        <StatCard label="Pending Review" value={pending} icon="pending" />
        <StatCard
          label="Available Coins"
          value={coins}
          icon="toll"
          sub={`≈ $${coinsToUsdWithdraw(coins)} USD`}
          accent
        />
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Earnings chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-primary">Earnings This Week</h2>
              <p className="text-xs text-primary/50 mt-0.5">
                Coins earned per day (approved)
              </p>
            </div>
            <span className="text-2xl font-headline font-bold text-secondary">
              +{chartData.reduce((s, d) => s + d.coins, 0)}
              <span className="text-sm font-normal text-primary/40 ml-1">
                coins
              </span>
            </span>
          </div>
          <div className="flex items-end gap-2 h-32">
            {chartData.map((d) => (
              <div
                key={d.label}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-secondary font-bold">
                  {d.coins > 0 ? d.coins : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-secondary/10 relative overflow-hidden"
                  style={{ height: "80px" }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-secondary rounded-t-md transition-all"
                    style={{ height: `${(d.coins / maxCoins) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-primary/40 font-medium">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance summary */}
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6 flex flex-col gap-5">
          <h2 className="font-bold text-primary">Performance</h2>

          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-primary/60">Approval Rate</span>
              <span className="font-bold text-primary">{approvalRate}%</span>
            </div>
            <div className="h-2 bg-primary/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary rounded-full transition-all"
                style={{ width: `${approvalRate}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-amber-700">
                {totalEarnings}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-bold mt-0.5">
                Lifetime Coins
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-blue-700">
                {pendingEarnings}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-blue-600/70 font-bold mt-0.5">
                Pending Coins
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-red-700">
                {rejected}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-red-600/70 font-bold mt-0.5">
                Rejected
              </p>
            </div>
            <div className="bg-secondary/5 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-secondary">
                ${coinsToUsdWithdraw(totalEarnings)}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-secondary/60 font-bold mt-0.5">
                Total USD
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent submissions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-primary/5 shadow-sm max-w-[280px]">
          <div className="px-4 sm:px-6 py-4 border-b border-primary/5 flex items-center justify-between">
            <h2 className="font-bold text-primary">Recent Submissions</h2>
            <Link
              href="/worker/submissions"
              className="text-xs text-secondary hover:underline"
            >
              View all
            </Link>
          </div>
          {recentSubmissions.length === 0 ? (
            <div className="py-14 text-center">
              <span className="material-symbols-outlined text-4xl text-primary/20 block mb-3">
                assignment
              </span>
              <p className="text-primary/40 text-sm">No submissions yet</p>
              <Link
                href="/worker/tasks"
                className="mt-4 inline-block text-secondary text-sm font-semibold hover:underline"
              >
                Browse tasks to get started
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-primary/5">
              {recentSubmissions.map((s) => (
                <div
                  key={String(s._id)}
                  className=" flex items-center justify-between px-4 sm:px-6 py-3.5 "
                >
                  <div className="min-w-0">
                    <p className="font-medium text-primary text-sm truncate">
                      {s.taskTitle}
                    </p>
                    <p className="text-xs text-primary/40 mt-0.5">
                      {format(new Date(s.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-sm font-bold text-secondary">
                      <span
                        className="material-symbols-outlined text-xs text-amber-500"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        toll
                      </span>
                      {s.payableAmount}
                    </span>
                    <Badge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          {/* Withdrawal CTA */}
          {canWithdraw ? (
            <div className="bg-linear-to-br from-primary to-secondary text-white rounded-xl p-5">
              <p className="text-xs text-white/70 uppercase tracking-wider font-bold">
                Ready to Withdraw
              </p>
              <p className="text-3xl font-headline font-bold mt-1">
                {coins} coins
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                ≈ ${coinsToUsdWithdraw(coins)} USD
              </p>
              <Link
                href="/worker/withdrawals"
                className="mt-4 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Withdraw Now
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </Link>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <p className="text-xs text-amber-700 uppercase tracking-wider font-bold">
                Progress to Withdrawal
              </p>
              <p className="text-2xl font-headline font-bold text-amber-900 mt-1">
                {coins} / {MIN_WITHDRAWAL_COINS}
              </p>
              <div className="mt-3 h-2 bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${Math.min((coins / MIN_WITHDRAWAL_COINS) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-amber-700/70 text-xs mt-2">
                {MIN_WITHDRAWAL_COINS - coins} more coins needed
              </p>
            </div>
          )}

          {/* Quick links */}
          <div className="bg-white rounded-xl border border-primary/5 shadow-sm divide-y divide-primary/5 sm:divide-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-1 lg:divide-y lg:divide-primary/5">
            {[
              {
                href: "/worker/tasks",
                icon: "search",
                label: "Browse Tasks",
                desc: "Find work to complete",
              },
              {
                href: "/worker/submissions",
                icon: "assignment",
                label: "My Submissions",
                desc: `${pending} pending review`,
              },
              {
                href: "/worker/earnings",
                icon: "payments",
                label: "Earnings Portal",
                desc: `$${coinsToUsdWithdraw(totalEarnings)} total earned`,
              },
              {
                href: "/worker/profile",
                icon: "person",
                label: "My Profile",
                desc: "View badges & stats",
              },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 p-4 hover:bg-background/60 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-sm">
                    {a.icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-primary text-sm">
                    {a.label}
                  </p>
                  <p className="text-xs text-primary/40 truncate">{a.desc}</p>
                </div>
                <span className="material-symbols-outlined text-primary/20 ml-auto text-sm">
                  chevron_right
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
