import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Task from "@/models/Task";
import Payment from "@/models/Payment";
import Withdrawal from "@/models/Withdrawal";
import StatCard from "@/components/shared/StatCard";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";

export default async function AdminDashboard() {
  await auth();
  await connectDB();

  const [
    totalWorkers,
    totalBuyers,
    pendingWithdrawals,
    recentUsers,
    recentWithdrawals,
  ] = await Promise.all([
    User.countDocuments({ role: "worker" }),
    User.countDocuments({ role: "buyer" }),
    Withdrawal.countDocuments({ status: "pending" }),
    User.find().sort("-createdAt").limit(5).select("-passwordHash").lean(),
    Withdrawal.find({ status: "pending" }).sort("-createdAt").limit(5).lean(),
  ]);

  const coinsAgg = await User.aggregate([
    { $group: { _id: null, total: { $sum: "$coins" } } },
  ]);
  const paymentsAgg = await Payment.aggregate([
    { $match: { status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const totalCoins = coinsAgg[0]?.total ?? 0;
  const totalRevenue = paymentsAgg[0]?.total ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Admin Dashboard
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Platform overview and key metrics
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Workers" value={totalWorkers} icon="group" />
        <StatCard
          label="Total Buyers"
          value={totalBuyers}
          icon="business_center"
        />
        <StatCard
          label="Coins in System"
          value={totalCoins.toLocaleString()}
          icon="toll"
        />
        <StatCard
          label="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          icon="payments"
          accent
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-primary/5 flex items-center justify-between">
            <h2 className="font-bold text-primary">Recent Users</h2>
            <a
              href="/admin/users"
              className="text-xs text-secondary hover:underline flex items-center gap-1"
            >
              View all
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </a>
          </div>
          <div className="divide-y divide-primary/5">
            {recentUsers.map((u) => (
              <div
                key={String(u._id)}
                className="px-4 sm:px-6 py-3 flex items-center gap-3"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-secondary font-bold text-sm">
                  {u.name?.[0]?.toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary text-sm truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-primary/40 truncate">{u.email}</p>
                </div>
                {/* Meta */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge status={u.role} />
                  <span className="text-[10px] text-primary/30">
                    {format(new Date(u.createdAt), "MMM d")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-primary/5 flex items-center justify-between">
            <h2 className="font-bold text-primary">Pending Withdrawals</h2>
            <a
              href="/admin/withdrawals"
              className="text-xs text-secondary hover:underline flex items-center gap-1"
            >
              View all
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </a>
          </div>
          {recentWithdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="material-symbols-outlined text-primary/15 text-4xl">
                account_balance_wallet
              </span>
              <p className="text-primary/40 text-sm">No pending withdrawals</p>
            </div>
          ) : (
            <div className="divide-y divide-primary/5">
              {recentWithdrawals.map((w) => (
                <div
                  key={String(w._id)}
                  className="px-4 sm:px-6 py-3 flex items-center gap-3"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-secondary text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      payments
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary text-sm truncate">
                      {w.workerName}
                    </p>
                    <p className="text-xs text-primary/40">
                      {w.coinRequested} coins · ${w.amount}
                    </p>
                  </div>
                  {/* Status */}
                  <div className="shrink-0">
                    <Badge status={w.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
