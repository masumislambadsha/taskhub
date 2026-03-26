import { auth } from "@/lib/auth";
import { MdArrowBack, MdCategory, MdEdit } from 'react-icons/md';
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import Submission from "@/models/Submission";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Image from "next/image";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BuyerTaskDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  await connectDB();

  const task = await Task.findOne({
    _id: id,
    buyerId: session!.user.id,
  }).lean();
  if (!task) notFound();

  const [totalSubs, pendingSubs, approvedSubs, rejectedSubs] =
    await Promise.all([
      Submission.countDocuments({ taskId: id }),
      Submission.countDocuments({ taskId: id, status: "pending" }),
      Submission.countDocuments({ taskId: id, status: "approved" }),
      Submission.countDocuments({ taskId: id, status: "rejected" }),
    ]);

  const submissions = await Submission.find({ taskId: id })
    .sort("-createdAt")
    .limit(20)
    .lean();

  return (
    <div className="space-y-8">
      
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/buyer/tasks"
              className="text-primary/40 hover:text-primary transition-colors"
            >
              <MdArrowBack className="text-xl" />
            </Link>
            <Badge status={task.status} />
          </div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            {task.title}
          </h1>
          <p className="text-primary/50 text-sm mt-1">
            Posted{" "}
            {format(
              new Date(task.createdAt as unknown as string),
              "MMM d, yyyy",
            )}{" "}
            · Deadline {format(new Date(task.completionDate), "MMM d, yyyy")}
          </p>
        </div>
        <Link
          href={`/buyer/tasks/${id}/edit`}
          className="shrink-0 flex items-center gap-2 bg-white border border-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:border-secondary/30 transition-colors shadow-sm"
        >
          <MdEdit className="text-sm" />
          Edit Task
        </Link>
      </div>

      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Submissions", value: totalSubs, icon: "assignment" },
          { label: "Pending Review", value: pendingSubs, icon: "pending" },
          { label: "Approved", value: approvedSubs, icon: "check_circle" },
          {
            label: "Slots Remaining",
            value: task.requiredWorkers - task.filledWorkers,
            icon: "group",
            accent: true,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl p-5 shadow-sm border ${s.accent ? "bg-primary text-white border-primary" : "bg-white border-primary/5"}`}
          >
            <MdCategory className="text-secondary text-xl" />
            <div
              className={`text-2xl font-bold font-headline ${s.accent ? "text-white" : "text-primary"}`}
            >
              {s.value}
            </div>
            <div
              className={`text-xs mt-1 ${s.accent ? "text-white/60" : "text-primary/50"}`}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-4">
          {task.imageUrl && (
            <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
              <Image
                src={task.imageUrl}
                alt={task.title}
                width={400}
                height={200}
                className="w-full h-48 object-cover"
              />
            </div>
          )}
          <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-primary">Task Details</h2>
            {[
              { label: "Category", value: task.category ?? "General" },
              {
                label: "Payout per Worker",
                value: `${task.payableAmount} coins`,
              },
              { label: "Required Workers", value: task.requiredWorkers },
              { label: "Filled Workers", value: task.filledWorkers },
              {
                label: "Deadline",
                value: format(new Date(task.completionDate), "MMM d, yyyy"),
              },
            ].map((d) => (
              <div
                key={d.label}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-primary/50">{d.label}</span>
                <span className="font-semibold text-primary">{d.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6">
            <h2 className="font-bold text-primary mb-3">Description</h2>
            <p className="text-sm text-primary/60 leading-relaxed">
              {task.details}
            </p>
          </div>

          {task.submissionInfo && (
            <div className="bg-secondary/5 rounded-xl border border-secondary/10 p-6">
              <h2 className="font-bold text-primary mb-3">
                Submission Instructions
              </h2>
              <p className="text-sm text-primary/60 leading-relaxed">
                {task.submissionInfo}
              </p>
            </div>
          )}
        </div>

        
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-primary/5 flex items-center justify-between">
              <h2 className="font-bold text-primary">Submissions</h2>
              <Link
                href="/buyer/submissions"
                className="text-xs text-secondary hover:underline"
              >
                Review all
              </Link>
            </div>
            {submissions.length === 0 ? (
              <div className="p-10 text-center text-primary/40 text-sm">
                No submissions yet. Workers will start submitting soon.
              </div>
            ) : (
              <div className="divide-y divide-primary/5">
                {submissions.map((s) => (
                  <div
                    key={String(s._id)}
                    className="px-6 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-primary text-sm">
                        {s.workerName}
                      </p>
                      <p className="text-xs text-primary/40 mt-0.5 truncate">
                        {s.details.slice(0, 80)}...
                      </p>
                      <p className="text-xs text-primary/30 mt-1">
                        {format(
                          new Date(s.createdAt as unknown as string),
                          "MMM d, h:mm a",
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge status={s.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
