import { auth } from "@/lib/auth";
import { MdAddCircle, MdCategory, MdChevronRight, MdRateReview, MdToll } from 'react-icons/md';
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import Submission from "@/models/Submission";
import mongoose from "mongoose";
import StatCard from "@/components/shared/StatCard";
import Badge from "@/components/ui/Badge";
import Link from "next/link";
import { format, subDays, startOfDay } from "date-fns";

export default async function BuyerDashboard() {
  const session = await auth();
  await connectDB();

  const buyerId = new mongoose.Types.ObjectId(session!.user.id);

  const [totalTasks, openTasks, closedTasks, pendingSubmissions] =
    await Promise.all([
      Task.countDocuments({ buyerId: session!.user.id }),
      Task.countDocuments({ buyerId: session!.user.id, status: "open" }),
      Task.countDocuments({ buyerId: session!.user.id, status: "closed" }),
      Submission.countDocuments({
        taskBuyerId: session!.user.id,
        status: "pending",
      }),
    ]);

  const [coinsSpentAgg, approvedCount, rejectedCount, recentSubmissions] =
    await Promise.all([
      Task.aggregate([
        { $match: { buyerId } },
        {
          $group: {
            _id: null,
            total: {
              $sum: { $multiply: ["$requiredWorkers", "$payableAmount"] },
            },
          },
        },
      ]),
      Submission.countDocuments({
        taskBuyerId: session!.user.id,
        status: "approved",
      }),
      Submission.countDocuments({
        taskBuyerId: session!.user.id,
        status: "rejected",
      }),
      Submission.find({ taskBuyerId: session!.user.id, status: "pending" })
        .sort("-createdAt")
        .limit(5)
        .lean(),
    ]);

  const coinsSpent = coinsSpentAgg[0]?.total ?? 0;
  const totalSubmissions = approvedCount + rejectedCount + pendingSubmissions;
  const approvalRate =
    totalSubmissions > 0
      ? Math.round((approvedCount / totalSubmissions) * 100)
      : 0;

  // Last 7 days — tasks created per day
  const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
  const dailyTasks = await Task.aggregate([
    { $match: { buyerId, createdAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const taskMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    taskMap[format(subDays(new Date(), i), "yyyy-MM-dd")] = 0;
  }
  dailyTasks.forEach((d) => {
    taskMap[d._id] = d.count;
  });
  const chartData = Object.entries(taskMap).map(([date, count]) => ({
    label: format(new Date(date + "T00:00:00"), "EEE"),
    count,
  }));
  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            Welcome back, {session!.user.name?.split(" ")[0]}
          </h1>
          <p className="text-primary/60 text-sm mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Link
          href="/buyer/tasks/new"
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          <MdAddCircle className="text-sm" />
          Create Task
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={totalTasks} icon="task" />
        <StatCard
          label="Pending Reviews"
          value={pendingSubmissions}
          icon="rate_review"
        />
        <StatCard
          label="Coins Balance"
          value={session!.user.coins}
          icon="toll"
        />
        <StatCard
          label="Coins Spent"
          value={coinsSpent}
          icon="payments"
          accent
        />
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Task activity chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-primary/5 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-primary">Task Activity</h2>
              <p className="text-xs text-primary/50 mt-0.5">
                Tasks created in the last 7 days
              </p>
            </div>
            <span className="text-2xl font-headline font-bold text-secondary">
              {chartData.reduce((s, d) => s + d.count, 0)}
              <span className="text-sm font-normal text-primary/40 ml-1">
                tasks
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
                  {d.count > 0 ? d.count : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-secondary/10 relative overflow-hidden"
                  style={{ height: "80px" }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-secondary rounded-t-md transition-all"
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-primary/40 font-medium">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Task & submission breakdown */}
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6 flex flex-col gap-5">
          <h2 className="font-bold text-primary">Overview</h2>

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
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-green-700">
                {openTasks}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-green-600/70 font-bold mt-0.5">
                Open Tasks
              </p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-primary">
                {closedTasks}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-primary/40 font-bold mt-0.5">
                Closed Tasks
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-amber-700">
                {approvedCount}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-bold mt-0.5">
                Approved
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xl font-headline font-bold text-red-700">
                {rejectedCount}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-red-600/70 font-bold mt-0.5">
                Rejected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Submissions to review */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-primary/5 shadow-sm">
          <div className="px-6 py-4 border-b border-primary/5 flex items-center justify-between">
            <h2 className="font-bold text-primary">Submissions to Review</h2>
            <Link
              href="/buyer/submissions"
              className="text-xs text-secondary hover:underline"
            >
              View all
            </Link>
          </div>
          {recentSubmissions.length === 0 ? (
            <div className="py-14 text-center flex justify-center items-center flex-col">
              <MdRateReview className="text-4xl text-primary/20 block mb-3 mx-auto" />
              <p className="text-primary/40 text-sm">No pending submissions</p>
              <Link
                href="/buyer/tasks/new"
                className="mt-4 inline-block text-secondary text-sm font-semibold hover:underline"
              >
                Create a task to get started
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-primary/5">
              {recentSubmissions.map((s) => (
                <div
                  key={String(s._id)}
                  className="px-6 py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-primary text-sm truncate">
                      {s.taskTitle}
                    </p>
                    <p className="text-xs text-primary/50 mt-0.5">
                      by {s.workerName} ·{" "}
                      {format(new Date(s.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-sm font-bold text-secondary">
                      <MdToll className="text-sm text-amber-500" />
                      {s.payableAmount}
                    </span>
                    <Badge status={s.status} />
                    <Link
                      href="/buyer/submissions"
                      className="text-xs text-secondary hover:underline"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm divide-y divide-primary/5">
          {[
            {
              href: "/buyer/tasks/new",
              icon: "add_circle",
              label: "Create New Task",
              desc: `${session!.user.coins} coins available`,
            },
            {
              href: "/buyer/tasks",
              icon: "task",
              label: "My Tasks",
              desc: `${openTasks} open · ${closedTasks} closed`,
            },
            {
              href: "/buyer/submissions",
              icon: "rate_review",
              label: "Review Submissions",
              desc: `${pendingSubmissions} pending`,
            },
            {
              href: "/buyer/coins",
              icon: "toll",
              label: "Purchase Coins",
              desc: "Top up your balance",
            },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 p-4 hover:bg-background/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                <MdCategory className="text-secondary text-xl" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-primary text-sm">{a.label}</p>
                <p className="text-xs text-primary/40 truncate">{a.desc}</p>
              </div>
              <MdChevronRight className="text-xl" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}



