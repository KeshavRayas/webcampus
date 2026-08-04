import { z } from "zod";

export const SupportTicketCategorySchema = z.enum([
  "ACADEMICS",
  "ATTENDANCE",
  "MARKS",
  "ADMISSIONS",
  "FINANCE",
  "TECHNICAL",
  "OTHER",
]);

export const SupportTicketPrioritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const SupportTicketStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export const CreateSupportTicketSchema = z.object({
  category: SupportTicketCategorySchema,
  priority: SupportTicketPrioritySchema.default("MEDIUM"),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(10_000),
});

export const CreateSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

export const UpdateSupportTicketStatusSchema = z.object({
  status: SupportTicketStatusSchema,
});

export type CreateSupportTicketInput = z.infer<
  typeof CreateSupportTicketSchema
>;
export type CreateSupportMessageInput = z.infer<
  typeof CreateSupportMessageSchema
>;
export type UpdateSupportTicketStatusInput = z.infer<
  typeof UpdateSupportTicketStatusSchema
>;
