import { MdToll } from 'react-icons/md';
import Link from "next/link";
import Image from "next/image";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import { format } from "date-fns";
import CountUp from "@/components/ui/CountUp";
import { auth } from "@/lib/auth";

export default async function PublicTasksPage() {
  const session = await auth();
  let tasks: {
    _id: unknown;
    title: string;
    buyerName: string;
    payableAmount: number;
    requiredWorkers: number;
    filledWorkers: number;
    completionDate: Date | string;
    category?: string;
    status: string;
    imageUrl?: string;
  }[] = [];
  try {
    await connectDB();
    tasks = (await Task.find({ status: "open" })
      .sort("-createdAt")
      .limit(12)
      .lean()) as unknown as typeof tasks;
  } catch {}

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-15 md:py-16">
      <div className="mb-10">
        <h1 className="font-headline text-3xl sm:text-4xl font-bold text-primary mb-3">
          Available Tasks
        </h1>
        <p className="text-primary/60">
          {session?.user?.role === "worker"
            ? "Browse and complete tasks to earn coins."
            : "Sign up to start completing tasks and earning coins."}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map((task) => (
          <div
            key={String(task._id)}
            className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6 flex flex-col gap-4 hover:border-secondary/30 transition-colors"
          >
            {task.imageUrl && (
              <div className="relative w-full h-40 rounded-lg overflow-hidden shrink-0">
                <Image
                  src={task.imageUrl}
                  alt={task.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-primary leading-snug line-clamp-2">
                {task.title}
              </h3>
              {task.category && (
                 <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">
                   {task.category}
                 </span>
              )}
            </div>
            <div className="text-xs text-primary/50">by {task.buyerName}</div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 font-bold text-secondary">
                <MdToll className="text-sm text-amber-500" />
                <CountUp value={task.payableAmount} /> coins
              </span>
              <span className="text-xs text-primary/50">
                <CountUp value={task.requiredWorkers - task.filledWorkers} />{" "}
                slots left
              </span>
            </div>
            <div className="text-[10px] text-primary/30 uppercase font-bold tracking-wider">
              Deadline: {format(new Date(task.completionDate), "MMM d, yyyy")}
            </div>
            <Link
              href={
                session?.user?.role === "worker"
                  ? `/worker/tasks/${String(task._id)}`
                  : "/login"
              }
              className="mt-auto block text-center bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {session?.user?.role === "worker"
                ? "View & Apply"
                : "Sign up as worker to apply"}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}


