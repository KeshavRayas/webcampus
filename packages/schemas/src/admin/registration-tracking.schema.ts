import { z } from "zod";

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const RegistrationTrackingStatusFilterSchema = z.enum([
  "ALL",
  "REGISTERED",
  "PENDING",
]);

export const GetRegistrationTrackingQuerySchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
  semesterId: z.uuid("Invalid semester ID"),
  departmentId: optionalQueryString(z.uuid("Invalid department ID")),
  cycle: optionalQueryString(z.enum(["PHYSICS", "CHEMISTRY"])),
  statusFilter: optionalQueryString(
    RegistrationTrackingStatusFilterSchema
  ).default("ALL"),
});

export const GetStudentRegisteredCoursesParamsSchema = z.object({
  studentId: z.uuid("Invalid student ID"),
});

export const GetStudentRegisteredCoursesQuerySchema = z.object({
  semesterId: z.uuid("Invalid semester ID"),
  academicTermId: z.uuid("Invalid academic term ID"),
});

export type RegistrationTrackingStatusFilterType = z.infer<
  typeof RegistrationTrackingStatusFilterSchema
>;
export type GetRegistrationTrackingQueryType = z.infer<
  typeof GetRegistrationTrackingQuerySchema
>;
export type GetStudentRegisteredCoursesParamsType = z.infer<
  typeof GetStudentRegisteredCoursesParamsSchema
>;
export type GetStudentRegisteredCoursesQueryType = z.infer<
  typeof GetStudentRegisteredCoursesQuerySchema
>;
