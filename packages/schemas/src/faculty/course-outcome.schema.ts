import { z } from "zod";

export const CourseOutcomeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, "Code is required").max(50, "Code is too long"),
  description: z.string().min(1, "Description is required"),
  isActive: z.boolean().default(true),
});

export type CourseOutcomeType = z.infer<typeof CourseOutcomeSchema>;

export const UpdateCourseOutcomesSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  outcomes: z.array(CourseOutcomeSchema),
});

export type UpdateCourseOutcomesType = z.infer<
  typeof UpdateCourseOutcomesSchema
>;
