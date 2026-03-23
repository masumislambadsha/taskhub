import { z } from "zod";

export const withdrawalSchema = z.object({
  coinRequested: z.number().int().min(200, "Minimum 200 coins required"),
  paymentSystem: z.string().min(1, "Select a payment method"),
  accountNumber: z.string().min(3, "Account number is required"),
});

export type WithdrawalFormData = z.infer<typeof withdrawalSchema>;
