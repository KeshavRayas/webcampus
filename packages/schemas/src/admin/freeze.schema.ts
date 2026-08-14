import { z } from "zod";

const freezeTarget = z
  .object({
    courseAssignmentId: z.string().uuid().optional(),
    electiveBatchFacultyId: z.string().uuid().optional(),
  })
  .refine(
    (val) =>
      Boolean(val.courseAssignmentId) !== Boolean(val.electiveBatchFacultyId),
    {
      message:
        "Exactly one of courseAssignmentId or electiveBatchFacultyId is required",
    }
  );

export const AdminFreezeParamsSchema = freezeTarget;

export const AdminUnfreezeParamsSchema = freezeTarget;

export const AdminBulkFreezeSchema = z.object({
  departmentId: z.string().uuid().optional(),
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const AdminBulkUnfreezeSchema = z.object({
  departmentId: z.string().uuid().optional(),
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const AdminAttendanceWindowFiltersSchema = z.object({
  departmentId: z.string().uuid().optional(),
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const AdminAttendanceWindowFreezeSchema = z.object({
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

export const AdminAttendanceWindowRowSchema = z.object({
  courseAssignmentId: z.string().uuid().nullable(),
  electiveBatchFacultyId: z.string().uuid().nullable(),
  isElective: z.boolean(),
  courseCode: z.string(),
  courseName: z.string(),
  department: z.string(),
  hodName: z.string().nullable(),
  hodUsername: z.string().nullable(),
  facultyName: z.string(),
  semester: z.number(),
  sectionName: z.string(),
  batchName: z.string().nullable(),
  assignmentType: z.enum(["THEORY", "LAB"]),
  freeze: AdminAttendanceWindowFreezeSchema,
});

export type AdminFreezeParams = z.infer<typeof AdminFreezeParamsSchema>;
export type AdminUnfreezeParams = z.infer<typeof AdminUnfreezeParamsSchema>;
export type AdminBulkFreeze = z.infer<typeof AdminBulkFreezeSchema>;
export type AdminBulkUnfreeze = z.infer<typeof AdminBulkUnfreezeSchema>;
export type AdminAttendanceWindowFilters = z.infer<
  typeof AdminAttendanceWindowFiltersSchema
>;
export type AdminAttendanceWindowRow = z.infer<
  typeof AdminAttendanceWindowRowSchema
>;
