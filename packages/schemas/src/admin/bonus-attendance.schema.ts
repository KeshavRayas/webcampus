import { z } from "zod";

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const BonusAttendanceCycleSchema = z.enum(["PHYSICS", "CHEMISTRY"]);

export const GetBonusAttendanceWindowsQuerySchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
  semesterId: z.uuid("Invalid semester ID"),
  departmentId: optionalQueryString(z.uuid("Invalid department ID")),
  cycle: optionalQueryString(BonusAttendanceCycleSchema),
});

export const CreateBonusAttendanceWindowSchema = z
  .object({
    academicTermId: z.uuid("Invalid academic term ID"),
    semesterId: z.uuid("Invalid semester ID"),
    departmentId: z.uuid("Invalid department ID").optional(),
    cycle: BonusAttendanceCycleSchema.optional(),
    days: z.coerce.number().min(1).default(1),
  })
  .superRefine((value, ctx) => {
    if (value.departmentId && value.cycle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentId"],
        message: "Select either a department or a cycle for a window scope",
      });
    }
  });

export const ToggleBonusAttendanceWindowParamsSchema = z.object({
  id: z.uuid("Invalid window ID"),
});

export const ToggleBonusAttendanceWindowBodySchema = z.object({
  isOpen: z.boolean(),
});

export type BonusAttendanceCycleType = z.infer<
  typeof BonusAttendanceCycleSchema
>;
export type GetBonusAttendanceWindowsQueryType = z.infer<
  typeof GetBonusAttendanceWindowsQuerySchema
>;
export type CreateBonusAttendanceWindowType = z.infer<
  typeof CreateBonusAttendanceWindowSchema
>;
export type ToggleBonusAttendanceWindowParamsType = z.infer<
  typeof ToggleBonusAttendanceWindowParamsSchema
>;
export type ToggleBonusAttendanceWindowBodyType = z.infer<
  typeof ToggleBonusAttendanceWindowBodySchema
>;
