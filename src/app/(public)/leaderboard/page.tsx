import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Submission from "@/models/Submission";
import { coinsToUsdWithdraw } from "@/lib/coins";
import Image from "next/image";

export default async function LeaderboardPage() {
  await connectDB();

  const topWorkers = await Submission.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: "$workerId",
        workerName: { $first: "$workerName" },
        workerEmail: { $first: "$workerEmail" },
        totalTasks: { $sum: 1 },
        totalCoins: { $sum: "$payableAmount" },
      },
    },
    { $sort: { totalCoins: -1 } },
    { $limit: 20 },
  ]);

  const workerIds = topWorkers.map((w) => w._id?.toString());
  const users = await User.find({ _id: { $in: workerIds } })
    .select("_id photoUrl")
    .lean();
  const photoMap = Object.fromEntries(
    users.map((u) => [String(u._id), u.photoUrl]),
  );

  const rankStyles = [
    {
      bg: "bg-amber-400",
      text: "text-white",
      label: "🥇",
      ring: "ring-amber-300",
    },
    {
      bg: "bg-slate-300",
      text: "text-white",
      label: "🥈",
      ring: "ring-slate-200",
    },
    {
      bg: "bg-amber-600",
      text: "text-white",
      label: "🥉",
      ring: "ring-amber-500",
    },
  ];

  return (
    <main className="pb-13 md:pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-15 md:py-20 px-4 md:px-8">
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-secondary/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-block bg-amber-400/20 text-amber-300 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-5">
            Hall of Fame
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tighter leading-none mb-4">
            Top Earners
            <br />
            <span className="text-secondary">This Month</span>
          </h1>
          <p className="text-white/50 text-sm mt-4 max-w-xl mx-auto leading-relaxed">
            The highest-earning workers on TaskHub, ranked by total coins earned
            through approved submissions. Could your name be here?
          </p>
        </div>
      </section>

      {/* Podium — top 3 */}
      {topWorkers.length >= 3 && (
        <section className="max-w-3xl mx-auto px-4 md:px-8 -mt-6 relative z-10 overflow-hidden">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
            {/* 2nd place */}
            <div className="bg-white rounded-2xl border border-primary/5 shadow-md p-3 sm:p-6 text-center min-w-0">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🥈</div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 sm:mb-3 overflow-hidden ring-4 ring-slate-200">
                {photoMap[topWorkers[1]._id?.toString()] ? (
                  <Image
                    src={photoMap[topWorkers[1]._id?.toString()]!}
                    alt=""
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-primary/30 text-3xl">
                    account_circle
                  </span>
                )}
              </div>
              <p className="font-bold text-primary text-xs sm:text-sm truncate">
                {topWorkers[1].workerName}
              </p>
              <p className="text-[10px] sm:text-[11px] text-primary/40 mt-0.5">
                {topWorkers[1].totalTasks} tasks
              </p>
              <p className="font-headline font-extrabold text-secondary mt-2 text-xs sm:text-sm">
                {topWorkers[1].totalCoins.toLocaleString()} coins
              </p>
              <p className="text-[10px] sm:text-[11px] text-primary/30">
                {coinsToUsdWithdraw(topWorkers[1].totalCoins)}
              </p>
            </div>

            {/* 1st place */}
            <div className="bg-primary rounded-2xl shadow-xl p-4 sm:p-7 text-center -mt-6 min-w-0">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🥇</div>
              <div className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-2 sm:mb-3 overflow-hidden ring-4 ring-secondary/40">
                {photoMap[topWorkers[0]._id?.toString()] ? (
                  <Image
                    src={photoMap[topWorkers[0]._id?.toString()]!}
                    alt=""
                    width={72}
                    height={72}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-white/40 text-4xl">
                    account_circle
                  </span>
                )}
              </div>
              <p className="font-bold text-white text-sm truncate">
                {topWorkers[0].workerName}
              </p>
              <p className="text-[10px] sm:text-[11px] text-white/40 mt-0.5">
                {topWorkers[0].totalTasks} tasks
              </p>
              <p className="font-headline font-extrabold text-secondary mt-2 text-sm">
                {topWorkers[0].totalCoins.toLocaleString()} coins
              </p>
              <p className="text-[10px] sm:text-[11px] text-white/30">
                {coinsToUsdWithdraw(topWorkers[0].totalCoins)}
              </p>
              <span className="inline-block mt-3 bg-secondary/20 text-secondary text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                Top Earner
              </span>
            </div>

            {/* 3rd place */}
            <div className="bg-white rounded-2xl border border-primary/5 shadow-md p-3 sm:p-6 text-center min-w-0">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🥉</div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2 sm:mb-3 overflow-hidden ring-4 ring-amber-100">
                {photoMap[topWorkers[2]._id?.toString()] ? (
                  <Image
                    src={photoMap[topWorkers[2]._id?.toString()]!}
                    alt=""
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-primary/30 text-3xl">
                    account_circle
                  </span>
                )}
              </div>
              <p className="font-bold text-primary text-xs sm:text-sm truncate">
                {topWorkers[2].workerName}
              </p>
              <p className="text-[10px] sm:text-[11px] text-primary/40 mt-0.5">
                {topWorkers[2].totalTasks} tasks
              </p>
              <p className="font-headline font-extrabold text-secondary mt-2 text-xs sm:text-sm">
                {topWorkers[2].totalCoins.toLocaleString()} coins
              </p>
              <p className="text-[10px] sm:text-[11px] text-primary/30">
                {coinsToUsdWithdraw(topWorkers[2].totalCoins)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Full rankings table */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline font-bold text-primary">
            Full Rankings
          </h2>
          <span className="text-[11px] text-primary/40 font-medium">
            Top {topWorkers.length} workers
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_auto] gap-4 px-6 py-3 border-b border-primary/5 bg-primary/2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/30">
              #
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/30">
              Worker
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/30 text-right">
              Earned
            </span>
          </div>
          <div className="divide-y divide-primary/5">
            {topWorkers.map((w, i) => (
              <div
                key={String(w._id)}
                className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors ${i < 3 ? "bg-secondary/3" : ""}`}
              >
                {/* Rank */}
                <div className="w-8 shrink-0 text-center">
                  {i < 3 ? (
                    <span className="text-lg">{rankStyles[i].label}</span>
                  ) : (
                    <span className="font-bold text-primary/30 text-sm">
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${i < 3 ? "ring-2 " + rankStyles[i].ring : "bg-secondary/10"}`}
                >
                  {photoMap[w._id?.toString()] ? (
                    <Image
                      src={photoMap[w._id?.toString()]!}
                      alt=""
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-secondary text-xl">
                      account_circle
                    </span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-primary text-sm truncate">
                    {w.workerName}
                  </p>
                  <p className="text-xs text-primary/40">
                    {w.totalTasks} approved tasks
                  </p>
                </div>

                {/* Coins */}
                <div className="text-right shrink-0">
                  <p className="font-headline font-extrabold text-secondary text-sm">
                    {w.totalCoins.toLocaleString()} coins
                  </p>
                  <p className="text-xs text-primary/40">
                    {coinsToUsdWithdraw(w.totalCoins)}
                  </p>
                </div>
              </div>
            ))}

            {topWorkers.length === 0 && (
              <div className="px-6 py-16 text-center">
                <span className="material-symbols-outlined text-primary/20 text-5xl mb-3 block">
                  leaderboard
                </span>
                <p className="text-primary/40 text-sm">
                  No data yet. Complete tasks to appear on the leaderboard.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 mt-12">
        <div className="bg-primary rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-headline text-xl font-extrabold text-white mb-1">
              Want to be on this list?
            </h3>
            <p className="text-white/50 text-sm">
              Start completing tasks today and climb the ranks.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <a
              href="/register"
              className="inline-flex items-center gap-2 bg-secondary text-white p-3 md:px-6 md:py-3 rounded-lg font-bold sm:text-sm text-xs hover:bg-secondary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
              Join as Worker
            </a>
            <a
              href="/tasks"
              className="inline-flex items-center gap-2 bg-white/10 text-white p-3 md:px-6 md:py-3 rounded-lg font-bold sm:text-sm text-xs hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                task_alt
              </span>
              Browse Tasks
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
