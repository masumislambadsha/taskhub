import { MdAccountBalanceWallet, MdAddCircle, MdAddPhotoAlternate, MdArrowBack, MdArrowForward, MdAssignment, MdChevronLeft, MdChevronRight, MdClose, MdEdit, MdGroup, MdPayments, MdReceiptLong, MdTaskAlt, MdToll } from 'react-icons/md';
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";
import StatCard from "@/components/shared/StatCard";

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
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          All Submissions
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Platform-wide submission review
        </p>
      </div>

      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={all} icon="assignment" />
        <StatCard label="Pending Review" value={pending} icon="pending" />
        <StatCard label="Approved" value={approved} icon="check_circle" />
        <StatCard label="Rejected" value={rejected} icon="cancel" accent />
      </div>

      
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between">
          <h2 className="font-bold text-primary">Recent Submissions</h2>
          <span className="text-xs text-primary/40">
            {submissions.length} shown
          </span>
        </div>

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <MdAssignment className="text-5xl text-primary/20 block mb-3 mx-auto" />
            <p className="text-primary/40 text-sm">No submissions found</p>
          </div>
        ) : (
          <>
            
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-primary/5">
                  <tr>
                    {[
                      "Worker",
                      "Task",
                      "Buyer",
                      "Payout",
                      "Status",
                      "Date",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {submissions.map((s) => (
                    <tr
                      key={String(s._id)}
                      className="hover:bg-background/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-primary">
                          {s.workerName}
                        </p>
                        <p className="text-xs text-primary/40">
                          {s.workerEmail}
                        </p>
                      </td>
                      <td className="px-6 py-4 max-w-[180px]">
                        <p className="font-medium text-primary truncate">
                          {s.taskTitle}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-primary/60">
                        {s.taskBuyerName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <MdToll className="text-sm text-amber-500" />
                          <span className="font-bold text-primary">
                            {s.payableAmount}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={s.status} />
                      </td>
                      <td className="px-6 py-4 text-primary/40 text-xs whitespace-nowrap">
                        {format(
                          new Date(s.createdAt as unknown as string),
                          "MMM d, yyyy",
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            
            <div className="md:hidden divide-y divide-primary/5">
              {submissions.map((s) => (
                <div
                  key={String(s._id)}
                  className="px-4 py-4 space-y-2 hover:bg-background/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-secondary font-bold text-sm">
                      {s.workerName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary text-sm truncate">
                        {s.workerName}
                      </p>
                      <p className="text-xs text-primary/40 truncate">
                        {s.taskTitle}
                      </p>
                    </div>
                    <Badge status={s.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pl-12">
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                      <MdToll className="text-sm text-amber-500" />
                      <span className="text-xs font-bold text-primary">
                        {s.payableAmount}
                      </span>
                    </div>
                    <span className="text-xs text-primary/30">
                      {format(
                        new Date(s.createdAt as unknown as string),
                        "MMM d, yyyy",
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


