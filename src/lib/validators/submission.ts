import { z } from "zod";

export const submissionSchema = z.object({
  details: z.string().min(10, "Please provide submission details"),
  proofLinks: z.array(z.string().url("Invalid URL")).min(1, "At least one proof link is required"),
  proofImageUrl: z.string().url().optional().or(z.literal("")),
});

export type SubmissionFormData = z.infer<typeof submissionSchema>;
