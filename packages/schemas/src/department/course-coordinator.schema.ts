import { z } from "zod";

/**
 * Schema for updating the list of coordinators assigned to a course.
 * Accepts a courseId (from URL params) and an array of faculty IDs.
 */
export const UpdateCoordinatorsBodySchema = z.object({
  facultyIds: z
    .array(z.string().uuid("Each faculty ID must be a valid UUID"))
    .min(0, "Faculty IDs array is required"),
});

/**
 * Schema for validating the courseId path parameter.
 */
export const CoordinatorCourseParamsSchema = z.object({
  id: z.string().uuid("Course ID must be a valid UUID"),
});

/**
 * Response shape for a single coordinator entry.
 */
export const CoordinatorResponseSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  facultyId: z.string().uuid(),
  faculty: z.object({
    id: z.string().uuid(),
    shortName: z.string(),
    departmentId: z.string().uuid(),
    user: z.object({
      name: z.string(),
    }),
  }),
});

export type UpdateCoordinatorsBodyDTO = z.infer<
  typeof UpdateCoordinatorsBodySchema
>;
export type CoordinatorCourseParamsDTO = z.infer<
  typeof CoordinatorCourseParamsSchema
>;
export type CoordinatorResponseDTO = z.infer<typeof CoordinatorResponseSchema>;
