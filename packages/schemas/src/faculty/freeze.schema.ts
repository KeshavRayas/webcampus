import { z } from "zod";

export const ToggleFreezeParamsSchema = z.object({
  courseAssignmentId: z.string().uuid(),
});

export const GetFreezeParamsSchema = z.object({
  courseAssignmentId: z.string().uuid(),
});

export const GetFreezeStateQuerySchema = z.object({
  courseAssignmentId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
});

export const FreezeDisplayStateSchema = z.enum([
  "OPEN",
  "FROZEN_BY_FACULTY",
  "FROZEN_BY_HOD",
  "LOCKED_BY_ADMIN",
]);

export const FreezeActorRoleSchema = z.enum(["FACULTY", "HOD", "ADMIN"]);

export const FrozenByInfoSchema = z.object({
  frozenByRole: FreezeActorRoleSchema.nullable(),
  frozenByUsername: z.string().nullable(),
  frozenByDisplay: z.string().nullable(),
});

export const FreezeResponseDataSchema = z.object({
  displayState: FreezeDisplayStateSchema,
  lockedBy: z.enum(["FACULTY", "HOD", "ADMIN"]).nullable(),
  frozenBy: FrozenByInfoSchema,
  message: z.string().nullable(),
  courseAssignmentId: z.string().uuid(),
  frozenAt: z.string().datetime().nullable(),
});

export const FreezeTableRowSchema = z.object({
  courseAssignmentId: z.string().uuid(),
  courseCode: z.string(),
  courseName: z.string(),
  department: z.string(),
  facultyName: z.string(),
  semester: z.number(),
  freeze: FreezeResponseDataSchema,
});

export const FreezeFiltersSchema = z.object({
  departmentId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
});

export const FreezeParamsSchema = z.object({
  courseAssignmentId: z.string().uuid(),
});

export const FacultySectionQuerySchema = z.object({
  semesterId: z.string().uuid(),
});

export const FacultyAttendanceWindowFiltersSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const FacultyAttendanceWindowFrozenBySchema = z.object({
  frozenByRole: FreezeActorRoleSchema.nullable(),
  frozenByUsername: z.string().nullable(),
  frozenByDisplay: z.string().nullable(),
});

export const FacultyAttendanceWindowFreezeSchema = z.object({
  displayState: FreezeDisplayStateSchema,
  lockedBy: z.enum(["FACULTY", "HOD", "ADMIN"]).nullable(),
  frozenBy: FacultyAttendanceWindowFrozenBySchema,
  frozenAt: z.string().datetime().nullable(),
  message: z.string().nullable(),
});

export const FacultyAttendanceWindowRowSchema = z.object({
  courseAssignmentId: z.string().uuid(),
  courseCode: z.string(),
  courseName: z.string(),
  sectionId: z.string().uuid(),
  sectionName: z.string(),
  batchName: z.string().nullable(),
  assignmentType: z.string(),
  freeze: FacultyAttendanceWindowFreezeSchema,
});

export const FacultyBulkFreezeSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
});

export type ToggleFreezeParamsType = z.infer<typeof ToggleFreezeParamsSchema>;
export type GetFreezeParamsType = z.infer<typeof GetFreezeParamsSchema>;
export type GetFreezeStateQueryType = z.infer<typeof GetFreezeStateQuerySchema>;
export type FreezeDisplayState = z.infer<typeof FreezeDisplayStateSchema>;
export type FreezeResponseData = z.infer<typeof FreezeResponseDataSchema>;
export type FreezeTableRow = z.infer<typeof FreezeTableRowSchema>;
export type FreezeFilters = z.infer<typeof FreezeFiltersSchema>;
export type FreezeParams = z.infer<typeof FreezeParamsSchema>;
export type FacultyAttendanceWindowFilters = z.infer<
  typeof FacultyAttendanceWindowFiltersSchema
>;
export type FacultyAttendanceWindowRow = z.infer<
  typeof FacultyAttendanceWindowRowSchema
>;
export type FacultyBulkFreeze = z.infer<typeof FacultyBulkFreezeSchema>;
