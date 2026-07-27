import { z } from "zod";

export const FinanceStudentSearchQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Enter a student name, USN, or application number"),
  group: z.enum(["trustee", "accounts"]).optional(),
});

export const UpsertFinanceSchema = z.object({
  academicYear: z.string().trim().min(1, "Academic year is required"),
  finalFee: z.coerce.number().min(0, "Final fee cannot be negative"),
});

export const AddFinancePaymentSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Payment amount must be greater than zero"),
  reference: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(500).optional(),
  paidAt: z.coerce.date().optional(),
});

export type FinanceStudentSearchQuery = z.infer<
  typeof FinanceStudentSearchQuerySchema
>;
export type UpsertFinanceInput = z.infer<typeof UpsertFinanceSchema>;
export type AddFinancePaymentInput = z.infer<typeof AddFinancePaymentSchema>;
