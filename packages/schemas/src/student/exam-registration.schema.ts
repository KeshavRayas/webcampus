import { z } from "zod";

export const submitExamRegistrationSchema = z.object({
  courseIds: z.array(z.uuid("Invalid course ID")).min(1, "Select courses"),
});

const examRegistrationCandidateSchema = z.object({
  courseId: z.uuid(),
  code: z.string(),
  name: z.string(),
  courseType: z.string(),
  semesterLabel: z.string(),
  academicTermLabel: z.string(),
  attemptCount: z.number().int().nonnegative(),
  nextAttemptNumber: z.number().int().positive(),
  latestOutcome: z.string().nullable(),
  hasActiveExamRegistration: z.boolean(),
  eligible: z.boolean(),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const examRegistrationEligibilitySchema = z.object({
  isOpen: z.boolean(),
  candidates: z.array(examRegistrationCandidateSchema),
});

export const examRegistrationHistoryItemSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  code: z.string(),
  name: z.string(),
  academicTermLabel: z.string(),
  examType: z.string(),
  attemptNumber: z.number().int().positive(),
  status: z.string(),
  outcome: z.string().nullable(),
  seeMarks: z.number().nullable(),
  maxSeeMarks: z.number().nullable(),
  registeredAt: z.string(),
});

export const submitExamRegistrationResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type SubmitExamRegistrationType = z.infer<
  typeof submitExamRegistrationSchema
>;
export type ExamRegistrationCandidateType = z.infer<
  typeof examRegistrationCandidateSchema
>;
export type ExamRegistrationEligibilityType = z.infer<
  typeof examRegistrationEligibilitySchema
>;
export type ExamRegistrationHistoryItemType = z.infer<
  typeof examRegistrationHistoryItemSchema
>;
export type SubmitExamRegistrationResponseType = z.infer<
  typeof submitExamRegistrationResponseSchema
>;
