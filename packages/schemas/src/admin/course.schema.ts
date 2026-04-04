import { z } from "zod";
import {
  CreateCourseSchema,
  DeleteCourseSchema,
  UpdateCourseSchema,
} from "../department/course.schema";

export const AdminCourseBranchQuerySchema = z.object({
  departmentName: z.string().min(1, "Department is required"),
  semesterId: z.uuid("Invalid semester ID").optional(),
  cycle: z
    .enum(["PHYSICS", "CHEMISTRY", "NONE"])
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export const AdminCreateCourseSchema = CreateCourseSchema.safeExtend({
  departmentName: z.string().min(1, "Department is required"),
});

export const AdminUpdateCourseSchema = UpdateCourseSchema.safeExtend({
  departmentName: z.string().min(1, "Department is required"),
});

export const AdminDeleteCourseSchema = DeleteCourseSchema;

export type AdminCourseBranchQueryType = z.infer<
  typeof AdminCourseBranchQuerySchema
>;
