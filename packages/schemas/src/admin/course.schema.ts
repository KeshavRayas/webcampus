import { z } from "zod";
import {
  CreateCourseSchema,
  DeleteCourseSchema,
  UpdateCourseSchema,
} from "../department/course.schema";

const requireDepartmentIdOrName = (
  value: {
    departmentId?: string;
    departmentName?: string;
  },
  ctx: z.RefinementCtx
) => {
  if (!value.departmentId && !value.departmentName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departmentId"],
      message: "departmentId or departmentName is required",
    });
  }
};

export const AdminCourseBranchQuerySchema = z
  .object({
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
    semesterId: z.uuid("Invalid semester ID").optional(),
    cycle: z
      .enum(["PHYSICS", "CHEMISTRY", "NONE"])
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  })
  .superRefine(requireDepartmentIdOrName);

export const AdminCourseByIdQuerySchema = z
  .object({
    departmentId: z.uuid("Invalid department ID").optional(),
    departmentName: z.string().min(1, "Department is required").optional(),
  })
  .superRefine(requireDepartmentIdOrName);

export const AdminCreateCourseSchema = CreateCourseSchema;

export const AdminUpdateCourseSchema = UpdateCourseSchema;

export const AdminDeleteCourseSchema = DeleteCourseSchema;

export type AdminCourseBranchQueryType = z.infer<
  typeof AdminCourseBranchQuerySchema
>;

export type AdminCourseByIdQueryType = z.infer<
  typeof AdminCourseByIdQuerySchema
>;
