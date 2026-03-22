import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { format } from "date-fns";
import Link from "next/link";

export default async function WorkerMessagesPage() {
  const session = await auth();
  await connectDB();

  const notifications = await Notification.find({ toUserId: session!.user.id })
    .sort("-createdAt")
    .limit(50)
    .lean();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            Messages Hub
          </h1>
          <p className="text-primary/60 text-sm mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action="/api/v1/notifications/read-all" method="POST">
            <button
              type="submit"
              className="text-sm font-semibold text-secondary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">
                done_all
              </span>
              Mark all read
            </button>
          </form>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Notifications list */}
        <div className="lg:col-span-2 space-y-3">
          {notifications.length === 0 ? (
            <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-12 text-center">
              <span className="material-symbols-outlined text-primary/20 text-5xl block mb-3">
                notifications_none
              </span>
              <p className="text-primary/40 text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={String(n._id)}
                className={`bg-white p-5 rounded-xl border shadow-sm transition-all hover:shadow-md flex items-start gap-4 ${
                  !n.isRead
                    ? "border-secondary/20 bg-secondary/5"
                    : "border-primary/5"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    n.type === "success"
                      ? "bg-secondary/10 text-secondary"
                      : n.type === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-primary/5 text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {n.type === "success"
                      ? "check_circle"
                      : n.type === "warning"
                        ? "warning"
                        : "info"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-relaxed ${!n.isRead ? "font-semibold text-primary" : "text-primary/70"}`}
                  >
                    {n.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-primary/40">
                      {format(
                        new Date(n.createdAt as unknown as string),
                        "MMM d, h:mm a",
                      )}
                    </span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
                    )}
                  </div>
                  {n.actionRoute && n.type !== "warning" && (
                    <Link
                      href={n.actionRoute}
                      className="text-xs text-secondary font-semibold hover:underline mt-1 inline-flex items-center gap-1"
                    >
                      View details
                      <span className="material-symbols-outlined text-xs">
                        arrow_forward
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick links sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6">
            <h3 className="font-bold text-primary mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                {
                  href: "/worker/tasks",
                  icon: "search",
                  label: "Browse Tasks",
                },
                {
                  href: "/worker/submissions",
                  icon: "assignment",
                  label: "My Submissions",
                },
                {
                  href: "/worker/withdrawals",
                  icon: "payments",
                  label: "Withdrawals",
                },
                {
                  href: "/support",
                  icon: "contact_support",
                  label: "Contact Support",
                },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-primary/60 hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">
                    {a.icon}
                  </span>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-secondary/5 rounded-xl border border-secondary/10 p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-secondary">
                info
              </span>
              <h3 className="font-bold text-primary text-sm">
                About Notifications
              </h3>
            </div>
            <p className="text-xs text-primary/60 leading-relaxed">
              You receive notifications when buyers approve or reject your
              submissions, and when platform updates occur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
