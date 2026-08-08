import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import { auth } from "@/lib/auth";
import { format, formatDistanceToNow } from "date-fns";
import { MdChat, MdToll } from "react-icons/md";
import CountUp from "@/components/ui/CountUp";
import { getConversationId } from "@/lib/conversation";

type TaskDoc = {
  _id: unknown;
  title: string;
  details: string;
  category?: string;
  buyerId: unknown;
  buyerName: string;
  requiredWorkers: number;
  filledWorkers: number;
  payableAmount: number;
  completionDate: Date | string;
  submissionInfo: string;
  imageUrl?: string;
  status: string;
};

export default async function PublicTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  let task: TaskDoc | null = null;

  let related: TaskDoc[] = [];

  try {
    await connectDB();
    task = (await Task.findById(id).lean()) as TaskDoc | null;
    if (task) {
      related = (await Task.find({
        status: "open",
        _id: { $ne: id },
        ...(task.category ? { category: task.category } : {}),
      })
        .sort("-createdAt")
        .limit(3)
        .lean()) as TaskDoc[];
      if (related.length === 0) {
        related = (await Task.find({ status: "open", _id: { $ne: id } })
          .sort("-createdAt")
          .limit(3)
          .lean()) as TaskDoc[];
      }
    }
  } catch {}

  if (!task) notFound();

  const remaining = task.requiredWorkers - task.filledWorkers;
  const deadline = new Date(task.completionDate);
  const isWorker = session?.user?.role === "worker";
  const isBuyer = session?.user?.role === "buyer";

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      <nav className="text-xs text-primary/40 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/tasks" className="hover:text-primary transition-colors">
          Tasks
        </Link>
        <span>/</span>
        <span className="text-primary/70 truncate max-w-[16rem]">
          {task.title}
        </span>
      </nav>

      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
        <div className="lg:col-span-2 space-y-6">
          {task.imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-primary/5 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={task.imageUrl}
                alt={task.title}
                className="w-full h-64 md:h-96 object-cover"
              />
            </div>
          )}

          <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <h1 className="font-headline text-2xl md:text-3xl font-bold text-primary leading-tight">
                {task.title}
              </h1>
              {task.category && (
                <span className="text-xs bg-secondary/10 text-secondary px-3 py-1 rounded-full whitespace-nowrap">
                  {task.category}
                </span>
              )}
            </div>
            <p className="text-xs text-primary/40 mb-6">Posted by {task.buyerName}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs text-primary/50 mb-1">Payout</div>
                <div className="font-bold text-secondary flex items-center justify-center gap-1">
                  <MdToll className="text-sm text-amber-500" />
                  <CountUp value={task.payableAmount} />
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs text-primary/50 mb-1">Slots Left</div>
                <div className="font-bold text-primary">
                  <CountUp value={remaining} />
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs text-primary/50 mb-1">Deadline</div>
                <div className="font-bold text-primary text-xs">
                  {format(deadline, "MMM d, yyyy")}
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs text-primary/50 mb-1">Time Left</div>
                <div className="font-bold text-primary text-xs">
                  {formatDistanceToNow(deadline)}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="font-headline font-bold text-primary mb-3 text-lg">
                  Description / Overview
                </h2>
                <p className="text-primary/70 text-sm leading-relaxed whitespace-pre-wrap">
                  {task.details}
                </p>
              </div>

              <div>
                <h2 className="font-headline font-bold text-primary mb-3 text-lg">
                  Submission Instructions
                </h2>
                <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-5">
                  <p className="text-primary/70 text-sm leading-relaxed whitespace-pre-wrap">
                    {task.submissionInfo}
                  </p>
                </div>
              </div>

              <div className="bg-accent/15 border border-accent rounded-xl p-5 text-sm text-primary/70 flex items-start gap-3">
                <MdChat className="text-secondary mt-0.5 shrink-0" />
                <p>
                  Have a question about this task?{" "}
                  {isWorker ? (
                    "Open a conversation with the buyer from your dashboard to ask before you apply."
                  ) : (
                    "Register as a worker to message the buyer directly and apply for this task."
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-primary rounded-2xl p-6 md:p-8 text-white sticky lg:top-28">
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">
              Reward
            </p>
            <p className="font-headline text-3xl font-extrabold flex items-center gap-2 mb-4">
              <MdToll className="text-amber-400" />
              {task.payableAmount}{" "}
              <span className="text-base font-bold text-white/60">
                coins / task
              </span>
            </p>

            <div className="space-y-3 text-sm text-white/80 mb-6">
              <div className="flex justify-between">
                <span className="text-white/50">Workers needed</span>
                <span className="font-bold text-white">
                  {task.requiredWorkers}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Slots remaining</span>
                <span className="font-bold text-white">{remaining}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Deadline</span>
                <span className="font-bold text-white">
                  {format(deadline, "MMM d, yyyy")}
                </span>
              </div>
            </div>

            {task.status !== "open" || remaining <= 0 ? (
              <div className="bg-white/10 border border-white/20 rounded-xl p-4 text-center text-sm font-semibold">
                This task is no longer accepting submissions.
              </div>
            ) : isWorker ? (
              <div className="space-y-3">
                <Link
                  href={`/worker/tasks/${String(task._id)}`}
                  className="block w-full text-center bg-secondary text-white py-3.5 rounded-xl font-bold hover:scale-95 transition-transform"
                >
                  Apply & Submit Work
                </Link>
                <Link
                  href={`/worker/messages?conv=${getConversationId(String(task._id), String(session.user.id), String(task.buyerId))}&taskId=${String(task._id)}&taskTitle=${encodeURIComponent(task.title)}&otherId=${String(task.buyerId)}&otherName=${encodeURIComponent(task.buyerName)}`}
                  className="block w-full text-center bg-white/10 border border-white/20 text-white py-3.5 rounded-xl font-bold hover:bg-white/20 transition-colors"
                >
                  Message Buyer
                </Link>
              </div>
            ) : isBuyer ? (
              <div className="bg-white/10 border border-white/20 rounded-xl p-4 text-sm text-center">
                You are signed in as a buyer.{" "}
                <Link
                  href="/register?role=worker"
                  className="font-bold underline"
                >
                  Register as a worker
                </Link>{" "}
                to apply for tasks.
              </div>
            ) : (
              <div className="space-y-3">
                <Link
                  href={`/register?role=worker`}
                  className="block w-full text-center bg-secondary text-white py-3.5 rounded-xl font-bold hover:scale-95 transition-transform"
                >
                  Sign up as Worker to Apply
                </Link>
                <Link
                  href="/login"
                  className="block w-full text-center bg-white/10 border border-white/20 text-white py-3.5 rounded-xl font-bold hover:bg-white/20 transition-colors"
                >
                  Log in
                </Link>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6">
            <h3 className="font-headline font-bold text-primary mb-4">
              Key Information
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between gap-2">
                <span className="text-primary/50">Category</span>
                <span className="font-semibold text-primary text-right">
                  {task.category ?? "General"}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-primary/50">Status</span>
                <span className="font-semibold text-secondary capitalize">
                  {task.status}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-primary/50">Posted by</span>
                <span className="font-semibold text-primary text-right">
                  {task.buyerName}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-primary/50">Slots filled</span>
                <span className="font-semibold text-primary">
                  {task.filledWorkers} / {task.requiredWorkers}
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="font-headline text-2xl font-bold text-primary">
                Related tasks
              </h2>
              <p className="text-primary/50 text-sm mt-1">
                {task.category
                  ? `More tasks in ${task.category}`
                  : "More open tasks on the platform"}
              </p>
            </div>
            <Link
              href="/tasks"
              className="text-secondary font-bold text-sm hover:underline shrink-0"
            >
              View all tasks
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((t) => (
              <Link
                key={String(t!._id)}
                href={`/tasks/${String(t!._id)}`}
                className="group bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6 flex flex-col gap-3 hover:border-secondary/40 hover:shadow-md transition-all h-full"
              >
                {t!.imageUrl && (
                  <div className="relative w-full h-36 rounded-lg overflow-hidden shrink-0 bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t!.imageUrl}
                      alt={t!.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <h3 className="font-bold text-primary leading-snug line-clamp-2 group-hover:text-secondary transition-colors">
                  {t!.title}
                </h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 font-bold text-secondary">
                    <MdToll className="text-sm text-amber-500" />
                    <CountUp value={t!.payableAmount} /> coins
                  </span>
                  <span className="text-xs text-primary/50">
                    {t!.requiredWorkers - t!.filledWorkers} slots left
                  </span>
                </div>
                <span className="mt-auto text-center bg-primary text-white py-2 rounded-lg text-xs font-semibold group-hover:bg-primary/90 transition-colors">
                  View Details
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}