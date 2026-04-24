import { z } from "zod";

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const RegistrationWindowCycleSchema = z.enum(["PHYSICS", "CHEMISTRY"]);

export const GetRegistrationWindowsQuerySchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
  semesterId: z.uuid("Invalid semester ID"),
  departmentId: optionalQueryString(z.uuid("Invalid department ID")),
  cycle: optionalQueryString(RegistrationWindowCycleSchema),
});

export const CreateRegistrationWindowSchema = z
  .object({
    academicTermId: z.uuid("Invalid academic term ID"),
    semesterId: z.uuid("Invalid semester ID"),
    departmentId: z.uuid("Invalid department ID").optional(),
    cycle: RegistrationWindowCycleSchema.optional(),
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

export const ToggleRegistrationWindowParamsSchema = z.object({
  id: z.uuid("Invalid window ID"),
});

export const ToggleRegistrationWindowBodySchema = z.object({
  isOpen: z.boolean(),
});

export const RegistrationWindowCoursesParamsSchema = z.object({
  id: z.uuid("Invalid window ID"),
});

export type RegistrationWindowCycleType = z.infer<
  typeof RegistrationWindowCycleSchema
>;
export type GetRegistrationWindowsQueryType = z.infer<
  typeof GetRegistrationWindowsQuerySchema
>;
export type CreateRegistrationWindowType = z.infer<
  typeof CreateRegistrationWindowSchema
>;
export type ToggleRegistrationWindowParamsType = z.infer<
  typeof ToggleRegistrationWindowParamsSchema
>;
export type ToggleRegistrationWindowBodyType = z.infer<
  typeof ToggleRegistrationWindowBodySchema
>;
export type RegistrationWindowCoursesParamsType = z.infer<
  typeof RegistrationWindowCoursesParamsSchema
>;
