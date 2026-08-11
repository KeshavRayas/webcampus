import { z } from "zod";

export const FeedbackScoreSchema = z.number().int().min(1).max(5);

export const FeedbackQuestionSchema = z.object({
  questionNumber: z.number().int().min(1).max(10),
  questionText: z.string().trim().min(1).max(500),
});

export const FeedbackQuestionsSchema = z
  .array(FeedbackQuestionSchema)
  .length(10)
  .superRefine((questions, ctx) => {
    const numbers = questions.map((question) => question.questionNumber);
    if (
      new Set(numbers).size !== 10 ||
      numbers.some((number, index) => number !== index + 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Questions must be numbered from 1 to 10",
      });
    }
  });

export const FeedbackQuestionSetSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  questions: FeedbackQuestionsSchema,
});

export const FeedbackTermConfigurationSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  presetId: z.string().uuid(),
});

export const FeedbackPresetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  academicTermId: z.string().uuid().optional(),
  questions: FeedbackQuestionsSchema,
});

export const FeedbackPresetUpdateSchema = FeedbackPresetSchema.partial().extend(
  {
    questions: FeedbackQuestionsSchema.optional(),
  }
);

export const FeedbackRoundSchema = z
  .object({
    academicTermId: z.string().uuid(),
    semesterId: z.string().uuid(),
    roundNumber: z.number().int().min(1),
    name: z.string().trim().max(100).default(""),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isEnabled: z.boolean().default(false),
  })
  .refine((value) => value.startsAt < value.endsAt, {
    path: ["endsAt"],
    message: "End time must be after start time",
  });

export const FeedbackRoundUpdateSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    name: z.string().trim().max(100).optional(),
  })
  .refine((value) => value.startsAt < value.endsAt, {
    path: ["endsAt"],
    message: "End time must be after start time",
  });

export const FeedbackSubmissionSchema = z.object({
  courseAssignmentId: z.string().uuid(),
  feedbackRoundId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        score: FeedbackScoreSchema,
      })
    )
    .length(10),
});

export const FeedbackReportQuerySchema = z.object({
  academicTermId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  feedbackRoundId: z.string().uuid().optional(),
  assignmentType: z.enum(["THEORY", "LAB"]).optional(),
  maxPercentage: z.coerce.number().min(0).max(100).optional(),
  includeOpen: z.coerce.boolean().optional(),
});

export const FeedbackReportFiltersSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
});

export const CourseDistributionQuerySchema = z.object({
  facultyId: z.string().uuid(),
  courseId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
});

export type CourseDistributionQuery = z.infer<
  typeof CourseDistributionQuerySchema
>;

export const FeedbackRoleSchema = z.enum([
  "faculty",
  "hod",
  "department",
  "coe",
  "admin",
]);

export type FeedbackQuestionSetInput = z.infer<
  typeof FeedbackQuestionSetSchema
>;
export type FeedbackTermConfigurationInput = z.infer<
  typeof FeedbackTermConfigurationSchema
>;
export type FeedbackPresetInput = z.infer<typeof FeedbackPresetSchema>;
export type FeedbackRoundInput = z.infer<typeof FeedbackRoundSchema>;
export type FeedbackRoundUpdateInput = z.infer<
  typeof FeedbackRoundUpdateSchema
>;
export type FeedbackSubmissionInput = z.infer<typeof FeedbackSubmissionSchema>;
export type FeedbackReportQuery = z.infer<typeof FeedbackReportQuerySchema>;
export type FeedbackReportFilters = z.infer<typeof FeedbackReportFiltersSchema>;
