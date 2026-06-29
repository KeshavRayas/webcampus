import { z } from "zod";

export const MIN_CONDONATION = 75;
export const MAX_CONDONATION = 85;

export const HODCondonationFiltersSchema = z.object({
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const HODCondonationStudentRowSchema = z.object({
  attendanceId: z.string().uuid(),
  studentId: z.string().uuid(),
  usn: z.string(),
  name: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  courseId: z.string().uuid(),
  percentage: z.number(),
  total: z.number(),
  present: z.number(),
  condonationStatus: z.enum([
    "NOT_REQUESTED",
    "PENDING",
    "APPROVED",
    "REJECTED",
  ]),
});

export const HODCondonationStudentRowArraySchema = z.array(
  HODCondonationStudentRowSchema
);

export const HODCondonationCourseSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const HODCondonationCourseArraySchema = z.array(
  HODCondonationCourseSchema
);

export const HODCondonationAttendanceIdSchema = z.object({
  attendanceId: z.string().uuid(),
});

export const HODCondonationSemesterQuerySchema = z.object({
  semesterId: z.string().uuid().optional(),
});

export const HODCondonationApproveResponseSchema = z.object({
  attendanceId: z.string().uuid(),
  condonationStatus: z.enum([
    "NOT_REQUESTED",
    "PENDING",
    "APPROVED",
    "REJECTED",
  ]),
  percentage: z.number(),
});

export type HODCondonationFilters = z.infer<typeof HODCondonationFiltersSchema>;
export type HODCondonationStudentRow = z.infer<
  typeof HODCondonationStudentRowSchema
>;
export type HODCondonationCourse = z.infer<typeof HODCondonationCourseSchema>;
export type HODCondonationAttendanceId = z.infer<
  typeof HODCondonationAttendanceIdSchema
>;
export type HODCondonationApproveResponse = z.infer<
  typeof HODCondonationApproveResponseSchema
>;
