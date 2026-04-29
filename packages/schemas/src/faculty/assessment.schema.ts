import { z } from "zod";

export const CreateAssessmentQuestionSchema = z.object({
  part: z.string().min(1, "Part name is required"),
  qNumber: z.string().min(1, "Question number is required"),
  marks: z.number().min(1, "Marks must be at least 1"),
  co: z.string().optional(),
  po: z.string().optional(),
  bl: z.string().optional(),
  orGroupId: z.string().optional(),
});

export type CreateAssessmentQuestionType = z.infer<
  typeof CreateAssessmentQuestionSchema
>;

export const CreateAssessmentSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  semesterId: z.string().uuid("Invalid semester ID"),
  title: z.string().min(1, "Assessment title is required"),
  totalMarks: z.number().min(1, "Total marks must be at least 1"),
  questions: z
    .array(CreateAssessmentQuestionSchema)
    .min(1, "At least one question is required"),
});

export type CreateAssessmentType = z.infer<typeof CreateAssessmentSchema>;
