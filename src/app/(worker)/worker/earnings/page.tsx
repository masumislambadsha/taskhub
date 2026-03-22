import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import Withdrawal from "@/models/Withdrawal";
import mongoose from "mongoose";
import { coinsToUsdWithdraw } from "@/lib/coins";
import { format } from "date-fns";
import Link from "next/link";
import Badge from "@/components/ui/Badge";

export default async function WorkerEarningsPage() {
  const session = await auth();
  await connectDB();

  const [approvedSubmissions, withdrawals] = await Promise.all([
    Submission.find({ workerId: session!.user.id, status: "approved" })
      .sort("-updatedAt")
      .lean(),
    Withdrawal.find({ workerId: session!.user.id }).sort("-createdAt").lean(),
  ]);

  const earningsAgg = await Submission.aggregate([
    {
      $match: {
        workerId: new mongoose.Types.ObjectId(session!.user.id),
        status: "approved",
      },
    },
    { $group: { _id: null, total: { $sum: "$payableAmount" } } },
  ]);

  const pendingAgg = await Submission.aggregate([
    {
      $match: {
        workerId: new mongoose.Types.ObjectId(session!.user.id),
        status: "pending",
      },
    },
    { $group: { _id: null, total: { $sum: "$payableAmount" } } },
  ]);

  const totalEarned = earningsAgg[0]?.total ?? 0;
  const pendingCoins = pendingAgg[0]?.total ?? 0;
  const availableCoins = session!.user.coins;

  type TxItem = {
    id: string;
    type: "earning" | "withdrawal";
    title: string;
    ref: string;
    amount: number;
    status: string;
    date: string;
    positive: boolean;
  };

  const transactions: TxItem[] = [
    ...approvedSubmissions.map((s) => ({
      id: String(s._id),
      type: "earning" as const,
      title: s.taskTitle,
      ref: `Task #${String(s._id).slice(-6).toUpperCase()}`,
      amount: s.payableAmount,
      status: "approved",
      date: s.updatedAt as unknown as string,
      positive: true,
    })),
    ...withdrawals.map((w) => ({
      id: String(w._id),
      type: "withdrawal" as const,
      title: `Withdrawal via ${w.paymentSystem}`,
      ref: `WDR-${String(w._id).slice(-6).toUpperCase()}`,
      amount: w.coinRequested,
      status: w.status,
      date: w.createdAt as unknown as string,
      positive: false,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Earnings Portal
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Manage your task payouts and withdrawals
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary text-white p-8 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between h-56">
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-secondary/20 rounded-full blur-3xl" />
          <div className="z-10">
            <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
              Available Balance
            </span>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl opacity-60">🪙</span>
              <h4 className="text-5xl font-headline font-bold">
                {availableCoins}
              </h4>
              <span className="text-sm opacity-60">coins</span>
            </div>
            <p className="text-white/50 text-xs mt-1">
              ≈ {coinsToUsdWithdraw(availableCoins)}
            </p>
          </div>
          <Link
            href="/worker/withdrawals"
            className="z-10 inline-flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-secondary/90 transition-colors w-fit"
          >
            Withdraw Now
            <span className="material-symbols-outlined text-sm">
              arrow_forward
            </span>
          </Link>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-primary/5 flex flex-col justify-between h-56">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">
              Pending Clearance
            </span>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl text-primary/30">🪙</span>
              <h4 className="text-5xl font-headline font-bold text-primary">
                {pendingCoins}
              </h4>
            </div>
            <p className="text-xs text-primary/40 mt-2 italic">
              From pending submissions
            </p>
          </div>
          <div className="flex items-center gap-2 text-secondary font-semibold text-sm">
            <span className="material-symbols-outlined text-sm">schedule</span>
            Awaiting buyer approval
          </div>
        </div>

        <div className="bg-amber-50 p-8 rounded-xl shadow-sm border border-amber-100 flex flex-col justify-between h-56">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">
              Total Lifetime Earned
            </span>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl text-amber-400">🪙</span>
              <h4 className="text-5xl font-headline font-bold text-amber-900">
                {totalEarned}
              </h4>
            </div>
            <div className="mt-4 h-1 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{
                  width: `${Math.min((totalEarned / 10000) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
          <p className="text-amber-700/80 text-sm">
            ≈ {coinsToUsdWithdraw(totalEarned)} total
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline text-xl font-bold text-primary">
              Transaction History
            </h2>
            <p className="text-primary/50 text-sm mt-1">
              Detailed log of payouts and withdrawals
            </p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-10 text-center text-primary/40 text-sm">
            No transactions yet. Complete tasks to start earning.
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white p-5 rounded-xl shadow-sm border border-primary/5 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-5"
              >
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === "earning"
                      ? "bg-secondary/10 text-secondary"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined">
                    {tx.type === "earning"
                      ? "task_alt"
                      : "account_balance_wallet"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <h5 className="font-bold text-primary text-sm truncate">
                        {tx.title}
                      </h5>
                      <p className="text-[10px] text-primary/40 uppercase tracking-wider mt-0.5">
                        {tx.ref}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-bold font-headline ${tx.positive ? "text-secondary" : "text-red-500"}`}
                      >
                        {tx.positive ? "+" : "-"}
                        {tx.amount} coins
                      </span>
                      <div className="flex items-center gap-1.5 justify-end mt-1">
                        <Badge status={tx.status} />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-primary/30 mt-1">
                    {format(new Date(tx.date), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
