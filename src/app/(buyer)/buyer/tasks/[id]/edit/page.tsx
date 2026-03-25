"use client";

import { MdArrowBack, MdCalendarToday, MdExpandMore } from "react-icons/md";
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema) as any,
  });

  const category = watch("category") || "";

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
          {" "}
          <MdArrowBack className="text-sm" />
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
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Completion Deadline
              </label>
              <DatePicker
                className="w-full"
                value={watch("completionDate") ? parseDate(watch("completionDate")) : null}
                minValue={parseDate(new Date().toISOString().split("T")[0])}
                onChange={(date) => {
                  if (date) {
                    setValue("completionDate", date.toString(), {
                      shouldValidate: true,
                    });
                  }
                }}
              >
                <DateField.Group className="h-11 border border-primary/20 bg-background rounded-lg px-3 justify-between flex items-center gap-2 focus-within:ring-2 focus-within:ring-secondary transition-all">
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
