import { z } from "zod";
import {
  CourseMappingByCourseQuerySchema,
  CourseMappingStatusQuerySchema,
  DownloadMappingTemplateQuerySchema,
  UpsertCourseMappingSchema,
} from "../department/course-assignment.schema";

export const AdminCourseMappingStatusQuerySchema =
  CourseMappingStatusQuerySchema.extend({
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
  });

export const AdminCourseMappingByCourseQuerySchema =
  CourseMappingByCourseQuerySchema.extend({
    courseId: z.uuid("Invalid course ID"),
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
  }).superRefine((value, ctx) => {
    if (!value.departmentId && !value.departmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message: "departmentId or departmentName is required",
      });
    }
  });

export const AdminUpsertCourseMappingSchema = UpsertCourseMappingSchema.extend({
  departmentId: z.uuid("Invalid department ID").optional(),
  departmentName: z.string().min(1, "Department is required").optional(),
  reason: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (!value.departmentId && !value.departmentName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departmentId"],
      message: "departmentId or departmentName is required",
    });
  }
});

export const AdminCourseMappingFacultyQuerySchema = z
  .object({
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.departmentId && !value.departmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message: "departmentId or departmentName is required",
      });
    }
  });

export const AdminCourseMappingSectionsQuerySchema = z
  .object({
    semesterId: z.uuid("Invalid semester ID"),
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
    cycle: z
      .enum(["PHYSICS", "CHEMISTRY"])
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.departmentId && !value.departmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message: "departmentId or departmentName is required",
      });
    }
  });

export const AdminDeleteCourseMappingSchema = z
  .object({
    courseId: z.uuid("Invalid course ID"),
    semesterId: z.uuid("Invalid semester ID"),
    academicYear: z.string().min(1, "Academic year is required"),
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.departmentId && !value.departmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message: "departmentId or departmentName is required",
      });
    }
  });

export type AdminCourseMappingByCourseQueryType = z.infer<
  typeof AdminCourseMappingByCourseQuerySchema
>;
export type AdminCourseMappingStatusQueryType = z.infer<
  typeof AdminCourseMappingStatusQuerySchema
>;
export type AdminUpsertCourseMappingType = z.infer<
  typeof AdminUpsertCourseMappingSchema
>;

export const AdminDownloadMappingTemplateQuerySchema =
  DownloadMappingTemplateQuerySchema.extend({
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
  }).superRefine((value, ctx) => {
    if (!value.departmentId && !value.departmentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message: "departmentId or departmentName is required",
      });
    }
  });
