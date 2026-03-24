import { z } from "zod";

/**
 * Base course schema with all required fields
 */
const BaseCourseSchema = z.object({
  code: z
    .string()
    .min(1, "Course code is required")
    .max(20, "Course code must be less than 20 characters"),

  name: z
    .string()
    .min(1, "Course name is required")
    .max(200, "Course name must be less than 200 characters")
    .trim(),

  type: z.string(),

  credits: z
    .number()
    .int("Credits must be an integer")
    .min(1, "Credits must be at least 1")
    .max(10, "Credits cannot exceed 10"),

  hasLab: z.boolean(),

  departmentName: z.string().min(1, "Department is required"),

  semesterId: z.string().min(1, "Semester is required"),

  semesterNumber: z
    .number()
    .int()
    .min(1, "Semester number is required")
    .max(8, "Semester number must be between 1 and 8"),
});

/**
 * Schema for creating a new course
 */
export const CreateCourseSchema = BaseCourseSchema;

/**
 * Schema for updating an existing course
 * All fields are optional for partial updates
 */
export const UpdateCourseSchema = BaseCourseSchema.partial();

/**
 * Response schema for a single course
 */
export const CourseResponseSchema = BaseCourseSchema.extend({
  id: z.string().uuid(),
  // Add the joined semester relation
  semester: z
    .object({
      programType: z.string(),
      semesterNumber: z.number(),
      academicTerm: z
        .object({
          type: z.string(),
          year: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export type CreateCourseDTO = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseDTO = z.infer<typeof UpdateCourseSchema>;
export type CourseResponseDTO = z.infer<typeof CourseResponseSchema>;
