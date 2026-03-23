import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import mongoose from "mongoose";
import { coinsToUsdWithdraw } from "@/lib/coins";
import Link from "next/link";
import WorkerProfileClient from "./WorkerProfileClient";

export default async function WorkerProfilePage() {
  const session = await auth();
  await connectDB();

  const [totalApproved, totalSubmissions] = await Promise.all([
    Submission.countDocuments({
      workerId: session!.user.id,
      status: "approved",
    }),
    Submission.countDocuments({ workerId: session!.user.id }),
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
  const totalCoins = earningsAgg[0]?.total ?? 0;

  const recentTasks = await Submission.find({
    workerId: session!.user.id,
    status: "approved",
  })
    .sort("-updatedAt")
    .limit(5)
    .lean();

  const badges = [
    {
      icon: "award_star",
      label: "Rapid Response",
      earned: totalSubmissions >= 5,
    },
    { icon: "diamond", label: "Elite Precision", earned: totalApproved >= 10 },
    {
      icon: "potted_plant",
      label: "Community Pillar",
      earned: totalApproved >= 50,
    },
    { icon: "local_fire_department", label: "100-Day Streak", earned: false },
    { icon: "military_tech", label: "Mentor Status", earned: false },
    { icon: "workspace_premium", label: "Guild Leader", earned: false },
  ];

  const level =
    totalApproved >= 100
      ? "Master Level"
      : totalApproved >= 10
        ? "Pro Level"
        : "Starter";
  const isTop = totalApproved >= 50;

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <WorkerProfileClient
          name={session!.user.name ?? ""}
          email={session!.user.email ?? ""}
          image={session!.user.image ?? null}
          level={level}
          isTop={isTop}
        />

        <div className="lg:col-span-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-2 sm:col-span-1 bg-primary p-8 rounded-xl flex flex-col justify-between hover:bg-surface-container-lowest transition-all shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] group">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 group-hover:scale-110 transition-transform">
                task_alt
              </span>
              <div>
                <h3 className="font-headline text-3xl font-extrabold text-white">
                  {totalApproved}
                </h3>
                <p className="font-label uppercase text-[10px] tracking-widest text-white/60 mt-1">
                  Approved Tasks
                </p>
              </div>
            </div>

            <div className="bg-primary p-8 rounded-xl flex flex-col justify-between shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] group">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 group-hover:scale-110 transition-transform">
                monetization_on
              </span>
              <div>
                <h3 className="font-headline text-3xl font-extrabold text-white">
                  {session!.user.coins}
                </h3>
                <p className="font-label uppercase text-[10px] tracking-widest text-white/60 mt-1">
                  Current Coins
                </p>
              </div>
            </div>

            <div className="bg-primary p-8 rounded-xl flex flex-col justify-between hover:bg-surface-container-lowest transition-all shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] group">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 group-hover:scale-110 transition-transform">
                payments
              </span>
              <div>
                <h3 className="font-headline text-3xl font-extrabold text-white">
                  {coinsToUsdWithdraw(totalCoins)}
                </h3>
                <p className="font-label uppercase text-[10px] tracking-widest text-white/60 mt-1">
                  Total Earned
                </p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-3 bg-surface-container-lowest py-4 sm:p-8 rounded-xl shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="font-headline text-xl font-bold text-primary mb-2">
                    Worker Portfolio
                  </h3>
                  <p className="font-body text-on-surface-variant text-sm max-w-md">
                    {totalSubmissions} total submissions · {totalApproved}{" "}
                    approved · {totalSubmissions - totalApproved} pending or
                    rejected
                  </p>
                </div>
                <Link
                  href="/worker/submissions"
                  className="shrink-0 flex items-center gap-2 bg-secondary/10 text-secondary px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-secondary/20 transition-colors"
                >
                  View All
                  <span className="material-symbols-outlined text-sm">
                    arrow_forward
                  </span>
                </Link>
              </div>
              <div className="absolute right-0 top-0 w-64 h-full bg-linear-to-l from-secondary-container/10 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Mastery Badges */}
      <section>
        <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tight mb-8">
          Mastery Badges
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
          {badges.map((b) => (
            <div
              key={b.label}
              className={`bg-primary p-6 rounded-2xl flex flex-col items-center text-center group hover:bg-surface-container-high transition-colors ${!b.earned ? "opacity-50" : ""}`}
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] group-hover:-translate-y-1 transition-transform">
                <span
                  className={`material-symbols-outlined text-3xl ${b.earned ? "text-secondary" : "text-on-surface-variant"}`}
                  style={b.earned ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {b.earned ? b.icon : "lock"}
                </span>
              </div>
              <span className="font-label text-[9px] uppercase tracking-tighter text-white">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Commissions */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline text-xl font-bold text-primary">
            Recent Commissions
          </h2>
          <Link
            href="/worker/submissions"
            className="text-xs text-secondary font-semibold hover:underline flex items-center gap-1"
          >
            View All
            <span className="material-symbols-outlined text-sm">
              arrow_forward
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
          {recentTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <span className="material-symbols-outlined text-primary/15 text-5xl">
                assignment_turned_in
              </span>
              <p className="text-primary/40 text-sm">No approved tasks yet</p>
            </div>
          ) : (
            <div className="divide-y divide-primary/5">
              {recentTasks.map((s) => (
                <div
                  key={String(s._id)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-background/60 transition-colors"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-secondary text-lg"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      assignment_turned_in
                    </span>
                  </div>

                  {/* Title + buyer */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      {s.taskTitle}
                    </p>
                    <p className="text-xs text-primary/40 mt-0.5">
                      by {s.taskBuyerName} ·{" "}
                      {new Date(s.updatedAt as Date).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </p>
                  </div>

                  {/* Coins */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <span
                        className="material-symbols-outlined text-amber-500 text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        toll
                      </span>
                      <span className="text-sm font-extrabold text-primary">
                        {s.payableAmount}
                      </span>
                    </div>
                    <p className="text-[10px] text-secondary font-semibold uppercase tracking-wider mt-0.5">
                      Approved
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
