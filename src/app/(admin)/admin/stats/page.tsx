import { auth } from "@/lib/auth";
import iconMap from '@/lib/iconMap';
import { MdCategory, MdDescription, MdPayments, MdToll } from 'react-icons/md';
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Task from "@/models/Task";
import Submission from "@/models/Submission";
import Payment from "@/models/Payment";
import Withdrawal from "@/models/Withdrawal";
import CountUp from "@/components/ui/CountUp";
import StatsDateFilter from "@/components/admin/StatsDateFilter";
import RevenueLineChart from "@/components/admin/RevenueLineChart";
import { resolveDateRange, chartMonths } from "@/lib/statsDateRange";
import { Suspense } from "react";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

interface Props {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function AdminStatsPage({ searchParams }: Props) {
  await auth();
  await connectDB();

  const params = await searchParams;
  const preset = params.preset ?? "30d";
  const { start, end } = resolveDateRange(preset, params.from, params.to);
  const numMonths = chartMonths(preset);

  const duration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - duration);
  const prevEnd = start;

  const now = new Date();

  const [
    totalUsers,
    totalWorkers,
    totalBuyers,
    newUsersInRange,
    newUsersPrev,
    totalTasks,
    activeTasks,
    closedTasks,
    totalSubmissions,
    approvedSubmissions,
    rejectedSubmissions,
    pendingSubmissions,
    pendingWithdrawals,
    approvedWithdrawals,
    totalCoinsAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "worker" }),
    User.countDocuments({ role: "buyer" }),
    User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    User.countDocuments({ createdAt: { $gte: prevStart, $lt: prevEnd } }),
    Task.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Task.countDocuments({ status: "open" }),
    Task.countDocuments({ status: "closed" }),
    Submission.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Submission.countDocuments({
      status: "approved",
      createdAt: { $gte: start, $lt: end },
    }),
    Submission.countDocuments({
      status: "rejected",
      createdAt: { $gte: start, $lt: end },
    }),
    Submission.countDocuments({ status: "pending" }),
    Withdrawal.countDocuments({ status: "pending" }),
    Withdrawal.aggregate([
      { $match: { status: "approved", createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    User.aggregate([{ $group: { _id: null, total: { $sum: "$coins" } } }]),
  ]);

  const revenueAgg = await Payment.aggregate([
    { $match: { status: "success", createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  const totalRevenue = revenueAgg[0]?.total ?? 0;
  const totalPaymentCount = revenueAgg[0]?.count ?? 0;

  const prevRevenueAgg = await Payment.aggregate([
    {
      $match: {
        status: "success",
        createdAt: { $gte: prevStart, $lt: prevEnd },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const prevRevenue = prevRevenueAgg[0]?.total ?? 0;

  const totalCoins = totalCoinsAgg[0]?.total ?? 0;
  const totalWithdrawals = approvedWithdrawals[0]?.total ?? 0;

  const completionRate =
    totalSubmissions > 0
      ? ((approvedSubmissions / totalSubmissions) * 100).toFixed(1)
      : "0.0";
  const userGrowth =
    newUsersPrev > 0
      ? (((newUsersInRange - newUsersPrev) / newUsersPrev) * 100).toFixed(1)
      : newUsersInRange > 0
        ? "100.0"
        : "0.0";
  const revenueGrowth =
    prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : totalRevenue > 0
        ? "100.0"
        : "0.0";

  
  const monthlyTaskData = await Promise.all(
    Array.from({ length: numMonths }, (_, i) => {
      const d = new Date(
        now.getFullYear(),
        now.getMonth() - (numMonths - 1 - i),
        1,
      );
      const e = new Date(
        now.getFullYear(),
        now.getMonth() - (numMonths - 2 - i),
        1,
      );
      return Task.countDocuments({ createdAt: { $gte: d, $lt: e } });
    }),
  );
  const maxMonthly = Math.max(...monthlyTaskData, 1);
  const currentMonthLabels = Array.from({ length: numMonths }, (_, i) => {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - (numMonths - 1 - i),
      1,
    );
    return MONTHS[d.getMonth()];
  });

  
  const revLineMonths = Math.min(numMonths, 12);
  const revenueLineData = await Promise.all(
    Array.from({ length: revLineMonths }, async (_, i) => {
      const d = new Date(
        now.getFullYear(),
        now.getMonth() - (revLineMonths - 1 - i),
        1,
      );
      const e = new Date(
        now.getFullYear(),
        now.getMonth() - (revLineMonths - 2 - i),
        1,
      );
      const agg = await Payment.aggregate([
        { $match: { status: "success", createdAt: { $gte: d, $lt: e } } },
        {
          $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } },
        },
      ]);
      return {
        label: MONTHS[d.getMonth()],
        revenue: agg[0]?.total ?? 0,
        payments: agg[0]?.count ?? 0,
      };
    }),
  );

  
  const categoryStats = await Task.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);
  const totalCatTasks = categoryStats.reduce((s, c) => s + c.count, 0) || 1;

  
  const topTasks = await Submission.aggregate([
    { $match: { status: "approved", createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: "$taskTitle",
        count: { $sum: 1 },
        totalPayout: { $sum: "$payableAmount" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  
  const topWorkers = await Submission.aggregate([
    { $match: { status: "approved", createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: "$workerId",
        name: { $first: "$workerName" },
        email: { $first: "$workerEmail" },
        earnings: { $sum: "$payableAmount" },
        completions: { $sum: 1 },
      },
    },
    { $sort: { earnings: -1 } },
    { $limit: 5 },
  ]);

  
  const gatewayStats = await Payment.aggregate([
    { $match: { status: "success", createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: "$gateway",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);
  const totalGatewayRev = gatewayStats.reduce((s, g) => s + g.total, 0) || 1;

  
  const recentPayments = await Payment.find({ status: "success" })
    .sort("-createdAt")
    .limit(6)
    .lean();

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-primary/50 font-bold block mb-1">
            Performance Overview
          </span>
          <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            Advanced Analytics
          </h1>
        </div>
        <Suspense>
          <StatsDateFilter />
        </Suspense>
      </div>

      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: "Total Revenue",
            value: totalRevenue,
            prefix: "$",
            decimals: 2,
            trend: `${parseFloat(revenueGrowth) >= 0 ? "+" : ""}${revenueGrowth}%`,
            up: parseFloat(revenueGrowth) >= 0,
            sub: `${totalPaymentCount} payments`,
            icon: "payments",
          },
          {
            label: "Active Tasks",
            value: activeTasks,
            prefix: "",
            decimals: 0,
            trend: `${totalTasks} created`,
            up: true,
            sub: `${closedTasks} closed`,
            icon: "task_alt",
          },
          {
            label: "New Users",
            value: newUsersInRange,
            prefix: "",
            decimals: 0,
            trend: `${parseFloat(userGrowth) >= 0 ? "+" : ""}${userGrowth}% vs prev`,
            up: parseFloat(userGrowth) >= 0,
            sub: `${totalUsers} total`,
            icon: "group",
          },
          {
            label: "Completion Rate",
            value: parseFloat(completionRate),
            prefix: "",
            suffix: "%",
            decimals: 1,
            trend: `${approvedSubmissions} approved`,
            up: true,
            sub: `${totalSubmissions} total`,
            icon: "verified",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-primary/5 relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <p className="text-[10px] uppercase tracking-widest text-primary/40 font-bold">
                {m.label}
              </p>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                {(() => { const Icon = iconMap[m.icon] ?? MdCategory; return <Icon className="text-xl text-secondary" />; })()}
              </div>
            </div>
            <h3 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary mb-1">
              <CountUp
                value={m.value}
                prefix={m.prefix}
                suffix={m.suffix ?? ""}
                decimals={m.decimals}
              />
            </h3>
            <p className="text-[11px] text-primary/40 mb-2">{m.sub}</p>
            <div
              className={`flex items-center gap-1 text-xs font-bold ${m.up ? "text-secondary" : "text-red-500"}`}
            >
              <MdCategory className="text-secondary text-xl" />
              {m.trend}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-10 bg-linear-to-t from-secondary/5 to-transparent" />
          </div>
        ))}
      </div>

      
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-primary/5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="font-headline text-xl font-bold text-primary">
                Revenue Trend
              </h4>
              <p className="text-primary/50 text-sm mt-1">
                Monthly revenue over time
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-primary">
                ${totalRevenue.toFixed(2)}
              </span>
              <p className="text-[10px] uppercase font-bold text-primary/40">
                In Period
              </p>
            </div>
          </div>
          <RevenueLineChart data={revenueLineData} />
        </div>

        <div className="lg:col-span-4 bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-primary/5 flex flex-col gap-4">
          <h4 className="font-headline text-xl font-bold text-primary">
            Platform Health
          </h4>
          <p className="text-primary/50 text-sm -mt-2">
            Live system indicators
          </p>

          {[
            {
              label: "Coin Circulation",
              value: totalCoins.toLocaleString(),
              icon: "toll",
              color: "text-amber-500",
              bg: "bg-amber-50",
            },
            {
              label: "Pending Withdrawals",
              value: pendingWithdrawals.toString(),
              icon: "account_balance_wallet",
              color: "text-orange-500",
              bg: "bg-orange-50",
            },
            {
              label: "Pending Submissions",
              value: pendingSubmissions.toString(),
              icon: "pending_actions",
              color: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              label: "Total Withdrawn",
              value: `$${totalWithdrawals.toFixed(2)}`,
              icon: "move_to_inbox",
              color: "text-secondary",
              bg: "bg-secondary/10",
            },
            {
              label: "Workers",
              value: totalWorkers.toString(),
              icon: "engineering",
              color: "text-primary",
              bg: "bg-primary/5",
            },
            {
              label: "Buyers",
              value: totalBuyers.toString(),
              icon: "storefront",
              color: "text-primary",
              bg: "bg-primary/5",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2 border-b border-primary/5 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}
                >
                  {(() => { const Icon = iconMap[item.icon] ?? MdCategory; return <Icon className={`text-lg ${item.color}`} />; })()}
                </div>
                <span className="text-sm text-primary/70">{item.label}</span>
              </div>
              <span className="text-sm font-bold text-primary">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-primary/5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h4 className="font-headline text-xl font-bold text-primary">
                Task Volume
              </h4>
              <p className="text-primary/50 text-sm mt-1">
                Monthly task creation trends
              </p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xl font-bold text-primary">
                {totalTasks}
              </span>
              <span className="text-[10px] uppercase font-bold text-primary/40">
                In Period
              </span>
            </div>
          </div>
          <div className="h-48 flex items-end justify-between gap-3">
            {monthlyTaskData.map((val, i) => {
              const pct = Math.max((val / maxMonthly) * 100, 4);
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end gap-1 group/bar"
                >
                  <span className="text-[9px] font-bold text-primary/0 group-hover/bar:text-primary/60 transition-colors mb-1">
                    {val}
                  </span>
                  <div
                    className="w-full bg-primary rounded-t-sm transition-all hover:bg-secondary cursor-default"
                    style={{ height: `${pct}%` }}
                    title={`${val} tasks`}
                  />
                  <span className="text-[9px] text-primary/40 font-bold mt-1">
                    {currentMonthLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-primary/5">
          <h4 className="font-headline text-xl font-bold text-primary mb-1">
            Category Split
          </h4>
          <p className="text-primary/50 text-sm mb-6">
            Task distribution across sectors
          </p>
          <div className="relative w-36 h-36 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#ddf1fc"
                strokeWidth="20"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#004030"
                strokeWidth="20"
                strokeDasharray="251.2"
                strokeDashoffset="100"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#146a58"
                strokeWidth="20"
                strokeDasharray="251.2"
                strokeDashoffset="180"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#b6ab85"
                strokeWidth="20"
                strokeDasharray="251.2"
                strokeDashoffset="230"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {totalCatTasks}
              </span>
              <span className="text-[9px] uppercase font-bold text-primary/40">
                Tasks
              </span>
            </div>
          </div>
          <ul className="space-y-2">
            {categoryStats.slice(0, 4).map((c, i) => {
              const colors = [
                "bg-primary",
                "bg-secondary",
                "bg-amber-300",
                "bg-slate-300",
              ];
              return (
                <li
                  key={String(c._id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${colors[i]}`} />
                    <span className="text-sm text-primary/70">
                      {c._id || "Other"}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {Math.round((c.count / totalCatTasks) * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      
      <div className="grid lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-5 bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-primary/5">
          <h4 className="font-headline text-xl font-bold text-primary mb-1">
            Submission Funnel
          </h4>
          <p className="text-primary/50 text-sm mb-8">
            From submitted to outcome
          </p>
          <div className="space-y-4">
            {[
              {
                label: "Submitted",
                value: totalSubmissions,
                color: "bg-primary",
                pct: 100,
              },
              {
                label: "Approved",
                value: approvedSubmissions,
                color: "bg-secondary",
                pct:
                  totalSubmissions > 0
                    ? (approvedSubmissions / totalSubmissions) * 100
                    : 0,
              },
              {
                label: "Rejected",
                value: rejectedSubmissions,
                color: "bg-red-400",
                pct:
                  totalSubmissions > 0
                    ? (rejectedSubmissions / totalSubmissions) * 100
                    : 0,
              },
              {
                label: "Pending Review",
                value: pendingSubmissions,
                color: "bg-amber-400",
                pct:
                  totalSubmissions > 0
                    ? (pendingSubmissions / totalSubmissions) * 100
                    : 0,
              },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-primary/70 font-medium">
                    {row.label}
                  </span>
                  <span className="font-bold text-primary">
                    {row.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${row.color} rounded-full transition-all`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-primary/40 mt-1">
                  {row.pct.toFixed(1)}% of total
                </p>
              </div>
            ))}
          </div>
        </div>

        
        <div className="lg:col-span-7 bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-primary/5">
          <h4 className="font-headline text-xl font-bold text-primary mb-1">
            Payment Gateways
          </h4>
          <p className="text-primary/50 text-sm mb-8">
            Revenue split by payment method
          </p>
          {gatewayStats.length === 0 ? (
            <p className="text-primary/40 text-sm text-center py-8">
              No payment data yet
            </p>
          ) : (
            <div className="space-y-5">
              {gatewayStats.map((g) => {
                const pct = (g.total / totalGatewayRev) * 100;
                const icons: Record<string, string> = {
                  stripe: "credit_card",
                  bkash: "phone_android",
                  sslcommerz: "account_balance",
                };
                return (
                  <div key={String(g._id)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MdPayments className="text-base text-primary/50" />
                        <span className="text-sm font-semibold text-primary capitalize">
                          {g._id}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-primary">
                          ${g.total.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-primary/40 ml-2">
                          {g.count} txns
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-primary/40 mt-1">
                      {pct.toFixed(1)}% of revenue
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      
      <div className="grid lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-primary/5 overflow-hidden">
          <div className="p-4 sm:p-8 border-b border-primary/5">
            <h4 className="font-headline text-xl font-bold text-primary">
              Top Workers
            </h4>
            <p className="text-primary/50 text-sm mt-1">
              Highest earners in period
            </p>
          </div>
          <div className="divide-y divide-primary/5">
            {topWorkers.length === 0 && (
              <p className="px-4 sm:px-8 py-10 text-center text-primary/40 text-sm">
                No data yet
              </p>
            )}
            {topWorkers.map((w, i) => (
              <div
                key={String(w._id)}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-8 py-4 hover:bg-slate-50 transition-colors"
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-primary/5 text-primary/40"}`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-primary text-sm truncate">
                    {w.name}
                  </p>
                  <p className="text-[11px] text-primary/40 truncate">
                    {w.email}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <MdToll className="text-sm text-amber-500" />
                    <span className="text-sm font-bold text-primary">
                      {w.earnings.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-primary/40">
                    {w.completions} tasks
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        
        <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-primary/5 overflow-hidden">
          <div className="p-4 sm:p-8 border-b border-primary/5">
            <h4 className="font-headline text-xl font-bold text-primary">
              Recent Payments
            </h4>
            <p className="text-primary/50 text-sm mt-1">
              Latest successful transactions
            </p>
          </div>
          <div className="divide-y divide-primary/5">
            {recentPayments.length === 0 && (
              <p className="px-4 sm:px-8 py-10 text-center text-primary/40 text-sm">
                No payments yet
              </p>
            )}
            {recentPayments.map((p) => {
              const gatewayIcons: Record<string, string> = {
                stripe: "credit_card",
                bkash: "phone_android",
                sslcommerz: "account_balance",
              };
              const date = new Date(p.createdAt);
              return (
                <div
                  key={String(p._id)}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-8 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <MdPayments className="text-base text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      {p.userEmail}
                    </p>
                    <p className="text-[11px] text-primary/40 capitalize">
                      {p.gateway} · {p.coinsPurchased.toLocaleString()} coins
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">
                      ${p.amount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-primary/40">
                      {date.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      
      <div className="bg-white rounded-xl shadow-sm border border-primary/5 overflow-hidden">
        <div className="p-8 border-b border-primary/5">
          <h4 className="font-headline text-xl font-bold text-primary">
            Top Performing Tasks
          </h4>
          <p className="text-primary/50 text-sm mt-1">
            Most completed tasks by approval count
          </p>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 sm:px-8 py-3 sm:py-4 text-left text-[10px] font-bold uppercase tracking-widest text-primary/40">
                Task
              </th>
              <th className="px-4 sm:px-8 py-3 sm:py-4 text-left text-[10px] font-bold uppercase tracking-widest text-primary/40">Completions
              </th>
              <th className="px-4 sm:px-8 py-3 sm:py-4 text-left text-[10px] font-bold uppercase tracking-widest text-primary/40">Total Payout
              </th>
              <th className="px-4 sm:px-8 py-3 sm:py-4 text-right text-[10px] font-bold uppercase tracking-widest text-primary/40">
                Avg / Task
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {topTasks.map((c) => (
              <tr
                key={String(c._id)}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 sm:px-8 py-4 sm:py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-amber-50 flex items-center justify-center text-amber-700">`n                  <MdDescription className="text-base text-secondary" />
                    </div>
                    <p className="font-bold text-primary max-w-[200px] truncate">
                      {c._id}
                    </p>
                  </div>
                </td>
                <td className="px-8 py-5 font-medium text-primary">
                  {c.count.toLocaleString()}
                </td>
                <td className="px-8 py-5 font-medium text-primary">
                  <span className="flex items-center gap-1">
                    <MdToll className="text-sm text-amber-500" />
                    {c.totalPayout.toLocaleString()}
                  </span>
                </td>
                <td className="px-8 py-5 text-right font-medium text-primary/60">
                  {c.count > 0 ? (c.totalPayout / c.count).toFixed(1) : "—"}
                </td>
              </tr>
            ))}
            {topTasks.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-8 py-10 text-center text-primary/40 text-sm"
                >
                  No data yet
                </td>
              </tr>
            )}
          </tbody></table></div></div>
    </div>
  );
}




