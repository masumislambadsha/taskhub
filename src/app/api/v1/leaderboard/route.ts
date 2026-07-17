import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Submission from "@/models/Submission";

export async function GET() {
  await connectDB();

  const workers = await User.find({ role: "worker", status: "active" })
    .select("name email coins")
    .sort({ coins: -1 })
    .limit(100)
    .lean();

  const workerIds = workers.map((w) => w._id);

  const stats = await Submission.aggregate([
    { $match: { workerId: { $in: workerIds } } },
    {
      $group: {
        _id: "$workerId",
        total: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
      },
    },
  ]);

  const statsMap = new Map(stats.map((s) => [s._id.toString(), s]));

  const data = workers.map((w, i) => {
    const s = statsMap.get(w._id.toString());
    const total = s?.total ?? 0;
    const approved = s?.approved ?? 0;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return {
      _id: w._id.toString(),
      name: w.name,
      email: w.email,
      coinsEarned: w.coins,
      approvalRate,
      rank: i + 1,
    };
  });

  return NextResponse.json({ data });
}
