import { z } from "zod";

export const createCourseRegistrationSchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  semester: z.number().int().positive("Semester must be a positive integer"),
  academicYear: z.string().min(1, "Academic year is required"),
});

export const updateCourseRegistrationSchema = z.object({
  hasDropped: z.boolean(),
});

export const CourseRegistrationResponseSchema =
  createCourseRegistrationSchema.extend({
    id: z.uuid("Invalid course registration ID"),
    studentId: z.uuid("Invalid student ID"),
    hasDropped: z.boolean().default(false),
  });

export type CreateCourseRegistrationType = z.infer<
  typeof createCourseRegistrationSchema
>;
export type UpdateCourseRegistrationType = z.infer<
  typeof updateCourseRegistrationSchema
>;
export type CourseRegistrationResponseType = z.infer<
  typeof CourseRegistrationResponseSchema
>;
