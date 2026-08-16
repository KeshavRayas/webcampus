import { z } from "zod";

export const AccountsStudentSearchQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Enter a student name, USN, or application number"),
  group: z.enum(["trustee", "accounts"]).optional(),
});

export const UpsertAccountsSchema = z.object({
  academicYear: z.string().trim().min(1, "Academic year is required"),
  finalFee: z.coerce.number().min(0, "Final fee cannot be negative"),
});

export const AddAccountsPaymentSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Payment amount must be greater than zero"),
  reference: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(500).optional(),
  paidAt: z.coerce.date().optional(),
});

export type AccountsStudentSearchQuery = z.infer<
  typeof AccountsStudentSearchQuerySchema
>;
export type UpsertAccountsInput = z.infer<typeof UpsertAccountsSchema>;
export type AddAccountsPaymentInput = z.infer<typeof AddAccountsPaymentSchema>;
