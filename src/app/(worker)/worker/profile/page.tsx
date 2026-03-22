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

            <div className="col-span-2 sm:col-span-3 bg-surface-container-lowest p-8 rounded-xl shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] relative overflow-hidden">
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
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
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
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tight">
            Recent Commissions
          </h2>
          <Link
            href="/worker/submissions"
            className="font-label text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline"
          >
            View All
          </Link>
        </div>

        {recentTasks.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] p-10 text-center text-on-surface-variant text-sm">
            No approved tasks yet. Start browsing tasks to earn coins.
          </div>
        ) : (
          <div className="space-y-6">
            {recentTasks.map((s) => (
              <div
                key={String(s._id)}
                className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] hover:bg-background transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-surface-container rounded-xl shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-secondary text-2xl">
                      assignment_turned_in
                    </span>
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-lg text-primary">
                      {s.taskTitle}
                    </h4>
                    <p className="font-body text-sm text-on-surface-variant mb-2">
                      by {s.taskBuyerName}
                    </p>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1 text-[10px] font-label text-secondary font-bold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-xs">
                          schedule
                        </span>
                        {new Date(s.updatedAt as Date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-label text-on-surface-variant font-bold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-xs">
                          check_circle
                        </span>
                        Verified
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <p className="font-headline font-extrabold text-primary text-xl">
                      {s.payableAmount}{" "}
                      <span className="text-xs font-label uppercase text-on-surface-variant tracking-tighter">
                        Coins
                      </span>
                    </p>
                    <p className="text-[10px] font-label text-secondary font-bold uppercase tracking-widest">
                      Completed
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant">
                    chevron_right
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
