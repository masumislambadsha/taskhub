import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  details: z.string().min(20, "Details must be at least 20 characters"),
  category: z.string().optional(),
  requiredWorkers: z.number().int().min(1, "At least 1 worker required"),
  payableAmount: z.number().min(1, "Minimum payout is 1 coin"),
  completionDate: z.string().min(1, "Completion date is required"),
  submissionInfo: z.string().min(10, "Submission instructions required"),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export type TaskFormData = z.infer<typeof taskSchema>;
