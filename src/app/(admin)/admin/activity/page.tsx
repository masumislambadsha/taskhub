import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import User from "@/models/User";
import Task from "@/models/Task";
import Submission from "@/models/Submission";
import Withdrawal from "@/models/Withdrawal";
import { format } from "date-fns";

type LogEntry = {
  id: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  detail: string;
  time: Date;
  tag: string;
  tagColor: string;
};

export default async function AdminActivityPage() {
  await auth();
  await connectDB();

  const [recentUsers, recentTasks, recentSubmissions, recentWithdrawals] =
    await Promise.all([
      User.find().sort("-createdAt").limit(10).lean(),
      Task.find().sort("-createdAt").limit(10).lean(),
      Submission.find().sort("-createdAt").limit(10).lean(),
      Withdrawal.find().sort("-createdAt").limit(10).lean(),
    ]);

  const logs: LogEntry[] = [
    ...recentUsers.map((u) => ({
      id: String(u._id),
      icon: "person_add",
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
      title: `New ${u.role} registered`,
      detail: `${u.name} · ${u.email}`,
      time: new Date(u.createdAt as unknown as string),
      tag: u.role,
      tagColor: "bg-secondary/10 text-secondary",
    })),
    ...recentTasks.map((t) => ({
      id: String(t._id),
      icon: "add_task",
      iconBg: "bg-primary/5",
      iconColor: "text-primary",
      title: "Task created",
      detail: t.title,
      time: new Date(t.createdAt as unknown as string),
      tag: t.status,
      tagColor: "bg-amber-50 text-amber-700",
    })),
    ...recentSubmissions.map((s) => ({
      id: String(s._id),
      icon: "assignment_turned_in",
      iconBg:
        s.status === "approved"
          ? "bg-secondary/10"
          : s.status === "rejected"
            ? "bg-red-50"
            : "bg-amber-50",
      iconColor:
        s.status === "approved"
          ? "text-secondary"
          : s.status === "rejected"
            ? "text-red-500"
            : "text-amber-600",
      title: `Submission ${s.status}`,
      detail: `${s.workerName} → ${s.taskTitle}`,
      time: new Date(s.updatedAt as unknown as string),
      tag: s.status,
      tagColor:
        s.status === "approved"
          ? "bg-secondary/10 text-secondary"
          : s.status === "rejected"
            ? "bg-red-50 text-red-600"
            : "bg-amber-50 text-amber-700",
    })),
    ...recentWithdrawals.map((w) => ({
      id: String(w._id),
      icon: "account_balance_wallet",
      iconBg: "bg-primary/5",
      iconColor: "text-primary",
      title: "Withdrawal requested",
      detail: `${w.workerName} · ${w.coinRequested} coins via ${w.paymentSystem}`,
      time: new Date(w.createdAt as unknown as string),
      tag: w.status,
      tagColor:
        w.status === "approved"
          ? "bg-secondary/10 text-secondary"
          : w.status === "rejected"
            ? "bg-red-50 text-red-600"
            : "bg-amber-50 text-amber-700",
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 50);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            Activity Log
          </h1>
          <p className="text-primary/60 text-sm mt-1">
            Platform-wide event history
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-primary/10 rounded-lg text-sm text-primary/60 shadow-sm self-start sm:self-auto w-full">
          <span className="material-symbols-outlined text-lg">filter_list</span>
          All Events
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "New Users", value: recentUsers.length, icon: "person_add" },
          { label: "New Tasks", value: recentTasks.length, icon: "add_task" },
          {
            label: "Submissions",
            value: recentSubmissions.length,
            icon: "assignment",
          },
          {
            label: "Withdrawals",
            value: recentWithdrawals.length,
            icon: "payments",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-4 sm:p-5 border border-primary/5 shadow-sm"
          >
            <span className="material-symbols-outlined text-secondary text-2xl mb-2 block">
              {s.icon}
            </span>
            <div className="text-2xl font-bold font-headline text-primary">
              {s.value}
            </div>
            <div className="text-xs text-primary/50 mt-1">
              {s.label} (recent)
            </div>
          </div>
        ))}
      </div>

      {/* Log */}
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-primary/5">
          <h2 className="font-bold text-primary">Recent Activity</h2>
        </div>
        <div className="divide-y divide-primary/5">
          {logs.map((log) => (
            <div
              key={log.id + log.title}
              className="px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3 sm:gap-4 hover:bg-slate-50 transition-colors"
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${log.iconBg}`}
              >
                <span
                  className={`material-symbols-outlined text-sm ${log.iconColor}`}
                >
                  {log.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-primary text-sm">
                    {log.title}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${log.tagColor}`}
                  >
                    {log.tag}
                  </span>
                </div>
                <p className="text-xs text-primary/50 mt-0.5 truncate">
                  {log.detail}
                </p>
                {/* Time shown below detail on mobile, hidden on sm+ */}
                <p className="text-xs text-primary/30 mt-1 sm:hidden">
                  {format(log.time, "MMM d, h:mm a")}
                </p>
              </div>
              <span className="text-xs text-primary/30 shrink-0 whitespace-nowrap hidden sm:block">
                {format(log.time, "MMM d, h:mm a")}
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-center text-primary/40 text-sm py-10">
              No activity yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
