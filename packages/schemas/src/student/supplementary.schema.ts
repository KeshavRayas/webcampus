import { z } from "zod";

export const submitSupplementarySchema = z.object({
  courseIds: z.array(z.uuid("Invalid course ID")).min(1, "Select courses"),
});

export const supplementaryCandidateSchema = z.object({
  courseId: z.uuid(),
  code: z.string(),
  name: z.string(),
  courseType: z.string(),
  totalCredits: z.number().int().nonnegative(),
  semesterLabel: z.string(),
  academicTermLabel: z.string(),
  attemptCount: z.number().int().nonnegative(),
  nextAttemptNumber: z.number().int().positive(),
  latestOutcome: z.string().nullable(),
  offered: z.boolean(),
  eligible: z.boolean(),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const supplementaryEligibilitySchema = z.object({
  isOpen: z.boolean(),
  candidates: z.array(supplementaryCandidateSchema),
});

export const supplementaryHistoryItemSchema = z.object({
  courseId: z.uuid(),
  code: z.string(),
  name: z.string(),
  semesterLabel: z.string(),
  academicTermLabel: z.string(),
  status: z.string(),
  registrationDate: z.string(),
});

export const submitSupplementaryResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type SubmitSupplementaryType = z.infer<typeof submitSupplementarySchema>;
export type SupplementaryCandidateType = z.infer<
  typeof supplementaryCandidateSchema
>;
export type SupplementaryEligibilityType = z.infer<
  typeof supplementaryEligibilitySchema
>;
export type SupplementaryHistoryItemType = z.infer<
  typeof supplementaryHistoryItemSchema
>;
export type SubmitSupplementaryResponseType = z.infer<
  typeof submitSupplementaryResponseSchema
>;
