"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema, TaskFormData } from "@/lib/validators/task";
import axios from "axios";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { TASK_CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import { ITask } from "@/types";
import Swal from "sweetalert2";

const confirmTheme = {
  confirmButtonColor: "#4a9782",
  cancelButtonColor: "#004030",
};

export default function EditTaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { data: task } = useQuery<ITask>({
    queryKey: ["task-edit", id],
    queryFn: () => axios.get(`/api/v1/tasks/${id}`).then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema) as any,
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        details: task.details,
        category: task.category,
        requiredWorkers: task.requiredWorkers,
        payableAmount: task.payableAmount,
        completionDate: task.completionDate.split("T")[0],
        submissionInfo: task.submissionInfo,
        imageUrl: task.imageUrl ?? "",
      });
    }
  }, [task, reset]);

  async function onSubmit(data: TaskFormData) {
    const result = await Swal.fire({
      title: "Save changes?",
      text: "Your task will be updated with the new details.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, save",
      cancelButtonText: "Cancel",
      ...confirmTheme,
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      await axios.put(`/api/v1/tasks/${id}`, data);
      toast.success("Task updated!");
      router.push("/buyer/tasks");
    } catch {
      toast.error("Failed to update task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/buyer/tasks"
          className="p-2 pl-0 rounded-lg hover:bg-primary/5 text-primary"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Edit Task
        </h1>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Task Title
            </label>
            <input
              {...register("title")}
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
            />
            {errors.title && (
              <p className="text-red-500 text-xs mt-1">
                {errors.title.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Description
            </label>
            <textarea
              {...register("details")}
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary resize-none"
            />
            {errors.details && (
              <p className="text-red-500 text-xs mt-1">
                {errors.details.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Submission Instructions
            </label>
            <textarea
              {...register("submissionInfo")}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary resize-none"
            />
            {errors.submissionInfo && (
              <p className="text-red-500 text-xs mt-1">
                {errors.submissionInfo.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Category
              </label>
              <select
                {...register("category")}
                className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              >
                <option value="">Select category</option>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Completion Deadline
              </label>
              <input
                {...register("completionDate")}
                type="date"
                className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              />
              {errors.completionDate && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.completionDate.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Required Workers
              </label>
              <input
                {...register("requiredWorkers", { valueAsNumber: true })}
                type="number"
                min={1}
                className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Payout per Worker
              </label>
              <input
                {...register("payableAmount", { valueAsNumber: true })}
                type="number"
                min={1}
                className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Task Image URL
            </label>
            <input
              {...register("imageUrl")}
              type="url"
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              placeholder="https://..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 text-xs sm:text-sm"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
