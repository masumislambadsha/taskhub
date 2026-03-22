import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";
import Link from "next/link";

export default async function AdminSubmissionsPage() {
  await auth();
  await connectDB();

  const [all, pending, approved, rejected] = await Promise.all([
    Submission.countDocuments(),
    Submission.countDocuments({ status: "pending" }),
    Submission.countDocuments({ status: "approved" }),
    Submission.countDocuments({ status: "rejected" }),
  ]);

  const submissions = await Submission.find()
    .sort("-createdAt")
    .limit(50)
    .lean();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          All Submissions
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Platform-wide submission review
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: all, icon: "assignment", accent: false },
          {
            label: "Pending Review",
            value: pending,
            icon: "pending",
            accent: false,
          },
          {
            label: "Approved",
            value: approved,
            icon: "check_circle",
            accent: false,
          },
          { label: "Rejected", value: rejected, icon: "cancel", accent: true },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl p-6 shadow-sm border ${s.accent ? "bg-primary text-white border-primary" : "bg-white border-primary/5"}`}
          >
            <span
              className={`material-symbols-outlined text-3xl mb-3 block ${s.accent ? "text-secondary" : "text-secondary"}`}
            >
              {s.icon}
            </span>
            <div
              className={`text-3xl font-bold font-headline ${s.accent ? "text-white" : "text-primary"}`}
            >
              {s.value}
            </div>
            <div
              className={`text-sm mt-1 ${s.accent ? "text-white/70" : "text-primary/60"}`}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-primary/5 flex items-center justify-between">
          <h2 className="font-bold text-primary">Recent Submissions</h2>
          <span className="text-xs text-primary/40">
            {submissions.length} shown
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/5 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-widest text-primary/40">
                  Worker
                </th>
                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-widest text-primary/40">
                  Task
                </th>
                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-widest text-primary/40">
                  Buyer
                </th>
                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-widest text-primary/40">
                  Payout
                </th>
                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-widest text-primary/40">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-widest text-primary/40">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {submissions.map((s) => (
                <tr
                  key={String(s._id)}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-primary">{s.workerName}</p>
                    <p className="text-xs text-primary/40">{s.workerEmail}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-primary max-w-[200px] truncate">
                      {s.taskTitle}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-primary/60">
                    {s.taskBuyerName}
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 font-bold text-secondary">
                      <span
                        className="material-symbols-outlined text-sm text-amber-500"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        toll
                      </span>
                      {s.payableAmount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge status={s.status} />
                  </td>
                  <td className="px-6 py-4 text-primary/40 text-xs">
                    {format(
                      new Date(s.createdAt as unknown as string),
                      "MMM d, yyyy",
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && (
            <p className="text-center text-primary/40 text-sm py-10">
              No submissions found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
