"use client";
import { MdAdd, MdAddPhotoAlternate, MdChat, MdClose, MdToll } from 'react-icons/md';

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  submissionSchema,
  SubmissionFormData,
} from "@/lib/validators/submission";
import axios from "axios";
import toast from "react-hot-toast";
import { ITask } from "@/types";
import { format, formatDistanceToNow } from "date-fns";
import CountUp from "@/components/ui/CountUp";
import { getConversationId } from "@/lib/conversation";
import { useSession } from "next-auth/react";

const IMGBB_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY!;

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: task, isLoading } = useQuery<ITask>({
    queryKey: ["task", id],
    queryFn: () => axios.get(`/api/v1/tasks/${id}`).then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { proofLinks: [""] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "proofLinks" as never,
  });

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await toast.promise(
        axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, fd),
        {
          loading: "Uploading image…",
          success: "Image uploaded",
          error: "Image upload failed",
        },
      );
      setUploadedUrl(res.data.data.url);
    } catch {
      setImagePreview(null);
    } finally {
      setImageUploading(false);
    }
  }

  async function onSubmit(data: SubmissionFormData) {
    setSubmitting(true);
    try {
      await axios.post("/api/v1/submissions", {
        ...data,
        taskId: id,
        proofImageUrl: uploadedUrl || undefined,
      });
      toast.success("Submission sent! Waiting for buyer review.");
      router.push("/worker/submissions");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : "Submission failed";
      toast.error(typeof msg === "string" ? msg : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading)
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-64 bg-white rounded-xl" />
        <div className="h-40 bg-white rounded-xl" />
      </div>
    );
  if (!task)
    return (
      <div className="text-center py-20 text-primary/40">Task not found</div>
    );

  const remaining = task.requiredWorkers - task.filledWorkers;
  const deadline = new Date(task.completionDate);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {task.imageUrl && (
        <img
          src={task.imageUrl}
          alt={task.title}
          className="w-full h-56 object-cover rounded-xl"
        />
      )}

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-headline text-2xl font-bold text-primary">
            {task.title}
          </h1>
          {task.category && (
            <span className="text-xs bg-secondary/10 text-secondary px-3 py-1 rounded-full whitespace-nowrap">
              {task.category}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

        <div>
          <h3 className="font-bold text-primary mb-2">Description</h3>
          <p className="text-primary/70 text-sm leading-relaxed whitespace-pre-wrap">
            {task.details}
          </p>
        </div>

        <div>
          <h3 className="font-bold text-primary mb-2">
            Submission Instructions
          </h3>
          <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-4">
            <p className="text-primary/70 text-sm leading-relaxed whitespace-pre-wrap">
              {task.submissionInfo}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-primary/40">Posted by {task.buyerName}</p>
          {session?.user && (
            <button
              onClick={() => {
                const convId = getConversationId(
                  id,
                  session.user.id,
                  task.buyerId,
                );
                router.push(
                  `/worker/messages?conv=${convId}&taskId=${id}&taskTitle=${encodeURIComponent(task.title)}&otherId=${task.buyerId}&otherName=${encodeURIComponent(task.buyerName)}`,
                );
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary border border-secondary/30 hover:border-primary/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <MdChat className="text-sm" />
              Message Buyer
            </button>
          )}
        </div>
      </div>

      {task.status !== "open" || remaining <= 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 font-semibold">
            This task is no longer accepting submissions.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6">
          <h2 className="font-bold text-primary text-lg mb-5">
            Submit Your Work
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Submission Details
              </label>
              <textarea
                {...register("details")}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary text-sm resize-none"
                placeholder="Describe what you did and provide any relevant details…"
              />
              {errors.details && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.details.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Proof Links <span className="text-primary/40"></span>
              </label>
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2 mb-2">
                  <input
                    {...register(`proofLinks.${i}`)}
                    type="url"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary text-sm"
                    placeholder="https://..."
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="p-2.5 text-red-400 hover:text-red-600"
                    >
                      <MdClose className="text-sm" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => append("")}
                className="text-xs text-secondary hover:text-primary flex items-center gap-1 mt-2"
              >
                <MdAdd className="text-sm" /> Add another link
              </button>

              {errors.proofLinks && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.proofLinks.message || "Invalid or missing links"}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Proof Image <span className="text-primary/40">(optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-primary/20 bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Proof preview"
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white text-primary text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setUploadedUrl("");
                      }}
                      className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      Remove
                    </button>
                  </div>
                  {imageUploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <span className="text-sm text-primary/60 font-medium animate-pulse">
                        Uploading…
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-lg border-2 border-dashed border-primary/20 bg-background hover:border-secondary/40 hover:bg-secondary/5 transition-colors flex flex-col items-center justify-center gap-2 text-primary/40 hover:text-secondary"
                >
                  <MdAddPhotoAlternate className="text-3xl" />
                  <span className="text-sm font-medium">
                    Click to upload proof image
                  </span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Work"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
