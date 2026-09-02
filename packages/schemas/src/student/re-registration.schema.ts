import { z } from "zod";

export const submitReRegistrationSchema = z.object({
  courseIds: z.array(z.uuid("Invalid course ID")).min(1, "Select courses"),
});

export const reRegistrationCandidateSchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  code: z.string(),
  name: z.string(),
  courseType: z.string(),
  totalCredits: z.number().int().nonnegative(),
  semesterLabel: z.string(),
  academicTermLabel: z.string(),
  attemptCount: z.number().int().nonnegative(),
  nextAttemptNumber: z.number().int().positive(),
  latestOutcome: z.string().nullable(),
  eligible: z.boolean(),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const reRegistrationEligibilitySchema = z.object({
  isOpen: z.boolean(),
  candidates: z.array(reRegistrationCandidateSchema),
});

export const reRegistrationHistoryItemSchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  code: z.string(),
  name: z.string(),
  semesterLabel: z.string(),
  academicTermLabel: z.string(),
  status: z.string(),
  registrationDate: z.string(),
});

export const submitReRegistrationResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type SubmitReRegistrationType = z.infer<
  typeof submitReRegistrationSchema
>;
export type ReRegistrationCandidateType = z.infer<
  typeof reRegistrationCandidateSchema
>;
export type ReRegistrationEligibilityType = z.infer<
  typeof reRegistrationEligibilitySchema
>;
export type ReRegistrationHistoryItemType = z.infer<
  typeof reRegistrationHistoryItemSchema
>;
export type SubmitReRegistrationResponseType = z.infer<
  typeof submitReRegistrationResponseSchema
>;
