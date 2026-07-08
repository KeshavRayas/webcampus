import { z } from "zod";

export const CourseEligibilitySchema = z.object({
  courseAssignmentId: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  courseType: z.string(),
  credits: z.number(),
  cieTotal: z.number().nullable(),
  attendancePercentage: z.number().nullable(),
  isFrozen: z.boolean(),
  markEligible: z.boolean(),
  attendanceEligible: z.boolean(),
  eligible: z.boolean(),
});

export const StudentInfoSchema = z.object({
  usn: z.string(),
  name: z.string(),
  photo: z.string().nullable(),
  departmentName: z.string(),
  currentSemester: z.number(),
  programType: z.string().nullable(),
  academicTermLabel: z.string(),
  sectionName: z.string().nullable(),
});

export const HallTicketDataSchema = z.object({
  usn: z.string(),
  name: z.string(),
  photo: z.string().nullable(),
  departmentName: z.string(),
  currentSemester: z.number(),
  programType: z.string().nullable(),
  academicTermLabel: z.string(),
  sectionName: z.string().nullable(),
  courses: z.array(CourseEligibilitySchema),
  allCoursesFrozen: z.boolean(),
  eligible: z.boolean(),
  isSent: z.boolean(),
  sentAt: z.string().nullable(),
});

export const SendHallTicketParamsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const HallTicketFilterSchema = z.object({
  departmentId: z.string().uuid().optional(),
  academicTermId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const HallTicketSendRecordSchema = z.object({
  studentId: z.string(),
  usn: z.string(),
  name: z.string(),
  departmentName: z.string(),
  currentSemester: z.number(),
  sectionName: z.string().nullable(),
  isSent: z.boolean(),
  sentAt: z.string().nullable(),
  sentBy: z.string().nullable(),
});

export const UnsendHallTicketParamsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
  academicTermId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export type CourseEligibility = z.infer<typeof CourseEligibilitySchema>;
export type StudentInfo = z.infer<typeof StudentInfoSchema>;
export type HallTicketData = z.infer<typeof HallTicketDataSchema>;
export type SendHallTicketParams = z.infer<typeof SendHallTicketParamsSchema>;
export type HallTicketFilter = z.infer<typeof HallTicketFilterSchema>;
export type HallTicketSendRecord = z.infer<typeof HallTicketSendRecordSchema>;
export type UnsendHallTicketParams = z.infer<
  typeof UnsendHallTicketParamsSchema
>;
