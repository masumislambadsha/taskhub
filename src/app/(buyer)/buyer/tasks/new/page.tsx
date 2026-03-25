"use client";

import {
  MdAddPhotoAlternate,
  MdArrowBack,
  MdCalendarToday,
  MdExpandMore,
} from "react-icons/md";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema, TaskFormData } from "@/lib/validators/task";
import axios from "axios";
import toast from "react-hot-toast";
import { useRef, useState } from "react";
import { TASK_CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import Swal from "sweetalert2";
import type { Selection } from "@heroui/react";
import {
  Dropdown,
  DropdownMenu,
  DropdownPopover,
  DropdownSection,
  DropdownItem,
  DropdownItemIndicator,
  Button,
  Label,
  DatePicker,
  DateField,
  Calendar,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";

const confirmTheme = {
  confirmButtonColor: "#4a9782",
  cancelButtonColor: "#004030",
};

const IMGBB_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY!;

export default function NewTaskPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<TaskFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(taskSchema) as any,
    defaultValues: { requiredWorkers: 1, payableAmount: 10 },
  });

  const category = watch("category") || "";
  const payableAmount = watch("payableAmount") || 0;
  const requiredWorkers = watch("requiredWorkers") || 0;
  const totalCost = Number(requiredWorkers) * Number(payableAmount);

  const hasEnough = (session?.user?.coins ?? 0) >= totalCost;
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  async function onSubmit(data: TaskFormData) {
    if (!hasEnough) {
      toast.error("Not enough coins. Please purchase more.");
      router.push("/buyer/coins");
      return;
    }
    const result = await Swal.fire({
      title: "Post this task?",
      text: `This will deduct ${totalCost} coins from your balance.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, post it",
      cancelButtonText: "Cancel",
      ...confirmTheme,
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      const res = await axios.post("/api/v1/tasks", {
        ...data,
        imageUrl: uploadedUrl,
      });
      toast.success("Task created successfully!");
      router.push(`/buyer/tasks/${res.data._id}/success`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : "Failed to create task";
      toast.error(typeof msg === "string" ? msg : "Failed to create task");
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
        > <MdArrowBack className="text-sm" />
        </Link>
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            Post New Task
          </h1>
          <p className="text-primary/60 text-sm">
            Balance:{" "}
            <span className="font-semibold text-secondary">
              {session?.user?.coins ?? 0} coins
            </span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-4 sm:p-6">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Task Title
            </label>
            <input
              {...register("title")}
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              placeholder="e.g. Watch my YouTube video and comment"
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
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary resize-none "
              placeholder="Describe the task in detail…"
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
              placeholder="What should workers submit as proof?"
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
              <Dropdown>
                <Button
                  variant="secondary"
                  className="w-full h-11 px-4 py-3 rounded-lg border border-primary/20 bg-background text-sm text-primary justify-between font-normal"
                >
                  {category || "Select category"}
                  <MdExpandMore className="text-lg opacity-40" />
                </Button>
                <DropdownPopover className="min-w-[240px] bg-transparent backdrop-blur-sm border border-primary/10 shadow-xl rounded-xl">
                  <DropdownMenu
                    selectedKeys={new Set([category])}
                    selectionMode="single"
                    onSelectionChange={(keys: Selection) => {
                      const val = Array.from(keys)[0] as string;
                      setValue("category", val, { shouldValidate: true });
                    }}
                    className="p-1"
                  >
                    <DropdownSection>
                      {TASK_CATEGORIES.map((c) => (
                        <DropdownItem
                          key={c}
                          id={c}
                          textValue={c}
                          className={`rounded-lg transition-colors ${category === c ? "bg-primary text-white" : "hover:bg-primary/5 text-primary/70"}`}
                        >
                          {c}
                        </DropdownItem>
                      ))}
                    </DropdownSection>
                  </DropdownMenu>
                </DropdownPopover>
              </Dropdown>
              {errors.category && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.category.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Completion Deadline
              </label>
              <DatePicker
                className="w-full"
                placeholderValue={parseDate(
                  new Date().toISOString().split("T")[0],
                )}
                minValue={parseDate(new Date().toISOString().split("T")[0])}
                onChange={(date) => {
                  if (date) {
                    setValue("completionDate", date.toString(), {
                      shouldValidate: true,
                    });
                  }
                }}
              >
                <DateField.Group className="h-11 border border-primary/20 bg-background rounded-lg  flex items-center gap-2 focus-within:ring-2 focus-within:ring-secondary transition-all">
                  <DateField.Input className="flex-1 text-sm text-primary">
                    {(segment) => (
                      <DateField.Segment
                        segment={segment}
                        className="focus:bg-secondary/20 focus:text-secondary rounded px-0.5 outline-none"
                      />
                    )}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger className="p-1.5 -mr-1 rounded-md hover:bg-primary/5 text-primary/40 transition-colors">
                      <MdCalendarToday className="text-lg" />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover className="bg-transparent backdrop-blur-sm border border-primary/10 shadow-2xl rounded-2xl p-6 min-w-[290px] md:min-w-[320px]">
                  <Calendar aria-label="Completion deadline" className="w-full">
                    <Calendar.Header className="flex items-center justify-between gap-2 mb-2">
                      <Calendar.YearPickerTrigger className="flex-1 flex justify-start text-base font-extrabold text-primary px-3 py-2 rounded-xl hover:bg-primary/5 transition-colors group">
                        <Calendar.YearPickerTriggerHeading />
                        <MdExpandMore className="ml-1 text-primary/30 group-hover:text-primary transition-colors" />
                      </Calendar.YearPickerTrigger>
                      <div className="flex gap-1.5 shrink-0">
                        <Calendar.NavButton
                          slot="previous"
                          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/5 text-primary/60 transition-colors border border-primary/5"
                        />
                        <Calendar.NavButton
                          slot="next"
                          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/5 text-primary/60 transition-colors border border-primary/5"
                        />
                      </div>
                    </Calendar.Header>
                    <Calendar.Grid className="w-full border-separate border-spacing-y-1">
                      <Calendar.GridHeader>
                        {(day) => (
                          <Calendar.HeaderCell className="text-[11px] font-black text-primary/30 uppercase tracking-widest pb-4">
                            {day}
                          </Calendar.HeaderCell>
                        )}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => (
                          <Calendar.Cell
                            date={date}
                            className="w-9 h-9 text-sm rounded-xl font-bold transition-all data-[selected=true]:bg-primary data-[selected=true]:text-white data-[outside-month=true]:opacity-20 hover:bg-secondary/10 hover:text-secondary cursor-pointer flex items-center justify-center data-[disabled=true]:opacity-10 data-[disabled=true]:cursor-not-allowed data-[today=true]:border data-[today=true]:border-secondary/30"
                          />
                        )}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid className="w-full">
                      <Calendar.YearPickerGridBody>
                        {({ year }) => (
                          <Calendar.YearPickerCell
                            year={year}
                            className="p-2 text-sm font-semibold rounded-lg hover:bg-primary/5 text-primary data-[selected=true]:bg-primary data-[selected=true]:text-white transition-colors"
                          />
                        )}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>
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
              {errors.requiredWorkers && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.requiredWorkers.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Payout per Worker (coins)
              </label>
              <input
                {...register("payableAmount", { valueAsNumber: true })}
                type="number"
                min={1}
                className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              />
              {errors.payableAmount && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.payableAmount.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Task Image <span className="text-primary/40">(optional)</span>
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
                  alt="Task preview"
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
                  Click to upload image
                </span>
              </button>
            )}
          </div>

          {/* Cost summary */}
          <div
            className={`rounded-lg p-4 border ${hasEnough ? "bg-secondary/5 border-secondary/20" : "bg-red-50 border-red-200"}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-primary">
                Total Cost
              </span>
              <span
                className={`font-bold text-lg ${hasEnough ? "text-secondary" : "text-red-600"}`}
              >
                {totalCost} coins
              </span>
            </div>
            {!hasEnough && totalCost > 0 && (
              <p className="text-red-600 text-xs mt-1">
                Insufficient coins.{" "}
                <Link href="/buyer/coins" className="underline">
                  Purchase more
                </Link>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !hasEnough}
            className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Creating…" : `Post Task (${totalCost} coins)`}
          </button>
        </form>
      </div>
    </div>
  );
}
