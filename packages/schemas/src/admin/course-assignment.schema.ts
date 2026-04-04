import { z } from "zod";
import {
  CourseMappingByCourseQuerySchema,
  CourseMappingStatusQuerySchema,
  UpsertCourseMappingSchema,
} from "../department/course-assignment.schema";

export const AdminCourseMappingStatusQuerySchema =
  CourseMappingStatusQuerySchema.extend({
    departmentName: z.string().min(1, "Department is required"),
  });

export const AdminCourseMappingByCourseQuerySchema =
  CourseMappingByCourseQuerySchema.extend({
    courseId: z.uuid("Invalid course ID"),
    departmentName: z.string().min(1, "Department is required"),
  });

export const AdminUpsertCourseMappingSchema = UpsertCourseMappingSchema.extend({
  departmentName: z.string().min(1, "Department is required"),
});

export const AdminCourseMappingFacultyQuerySchema = z.object({
  departmentName: z.string().min(1, "Department is required"),
});

export const AdminCourseMappingSectionsQuerySchema = z.object({
  semesterId: z.uuid("Invalid semester ID"),
  departmentName: z.string().min(1, "Department is required"),
  cycle: z
    .enum(["PHYSICS", "CHEMISTRY"])
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export const AdminDeleteCourseMappingSchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  semesterId: z.uuid("Invalid semester ID"),
  academicYear: z.string().min(1, "Academic year is required"),
  departmentName: z.string().min(1, "Department is required"),
});

export type AdminCourseMappingByCourseQueryType = z.infer<
  typeof AdminCourseMappingByCourseQuerySchema
>;
export type AdminUpsertCourseMappingType = z.infer<
  typeof AdminUpsertCourseMappingSchema
>;
