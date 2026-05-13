import { z } from "zod";

export const HODFreezeParamsSchema = z.object({
  courseAssignmentId: z.string().uuid(),
});

export const HODUnfreezeParamsSchema = z.object({
  courseAssignmentId: z.string().uuid(),
});

export const HODAttendanceWindowFreezeSchema = z.object({
  displayState: z.enum([
    "OPEN",
    "FROZEN_BY_FACULTY",
    "FROZEN_BY_HOD",
    "LOCKED_BY_ADMIN",
  ]),
  lockedBy: z.enum(["FACULTY", "HOD", "ADMIN"]).nullable(),
  frozenAt: z.string().datetime().nullable(),
  message: z.string().nullable(),
  frozenByRole: z.enum(["FACULTY", "HOD", "ADMIN"]).nullable(),
  frozenByUsername: z.string().nullable(),
  frozenByDisplay: z.string().nullable(),
});

export const HODAttendanceWindowRowSchema = z.object({
  courseAssignmentId: z.string().uuid(),
  courseCode: z.string(),
  courseName: z.string(),
  department: z.string(),
  facultyName: z.string(),
  semester: z.number(),
  sectionId: z.string().uuid(),
  sectionName: z.string(),
  batchName: z.string().nullable(),
  assignmentType: z.enum(["THEORY", "LAB"]),
  freeze: HODAttendanceWindowFreezeSchema,
});

export const HODAttendanceWindowFiltersSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
});

export const HODSectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const HODSectionQuerySchema = z.object({
  semesterId: z.string().uuid().optional(),
});

export const HODBulkFreezeSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
});

export const HODBulkUnfreezeSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
});

export type HODFreezeParams = z.infer<typeof HODFreezeParamsSchema>;
export type HODUnfreezeParams = z.infer<typeof HODUnfreezeParamsSchema>;
export type HODAttendanceWindowFreeze = z.infer<
  typeof HODAttendanceWindowFreezeSchema
>;
export type HODAttendanceWindowRow = z.infer<
  typeof HODAttendanceWindowRowSchema
>;
export type HODAttendanceWindowFilters = z.infer<
  typeof HODAttendanceWindowFiltersSchema
>;
export type HODSection = z.infer<typeof HODSectionSchema>;
export type HODBulkFreeze = z.infer<typeof HODBulkFreezeSchema>;
export type HODBulkUnfreeze = z.infer<typeof HODBulkUnfreezeSchema>;
