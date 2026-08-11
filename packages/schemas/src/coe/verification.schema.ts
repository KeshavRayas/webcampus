import { z } from "zod";

export const VerifyHallTicketSchema = z.object({
  token: z.string().min(1),
});

export const VerificationSettingSchema = z.object({
  academicTermId: z.string().uuid(),
  enabled: z.boolean(),
  windowStartAt: z.string().datetime().nullable().optional(),
  windowEndAt: z.string().datetime().nullable().optional(),
});

export const VerificationLogSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  academicTermId: z.string(),
  token: z.string().nullable(),
  verifiedById: z.string().nullable(),
  verifiedByRole: z.string().nullable(),
  result: z.string(),
  detail: z.string().nullable(),
  createdAt: z.string(),
});

export const VerificationLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  academicTermId: z.string().uuid().optional(),
  result: z.string().optional(),
});

export const VerificationResultSchema = z.object({
  valid: z.boolean(),
  result: z.string(),
  detail: z.string().nullable(),
  student: z
    .object({
      studentId: z.string(),
      usn: z.string(),
      name: z.string(),
      photo: z.string().nullable(),
      departmentName: z.string(),
      currentSemester: z.number(),
      programType: z.string().nullable(),
      academicTermLabel: z.string(),
      sectionName: z.string().nullable(),
      isSent: z.boolean(),
    })
    .nullable(),
  courses: z
    .array(
      z.object({
        courseCode: z.string(),
        courseName: z.string(),
        courseType: z.string(),
        credits: z.number(),
        cieTotal: z.number().nullable(),
        attendancePercentage: z.number().nullable(),
        eligible: z.boolean(),
        reason: z.string().nullable(),
      })
    )
    .optional(),
});

export type VerifyHallTicket = z.infer<typeof VerifyHallTicketSchema>;
export type VerificationSetting = z.infer<typeof VerificationSettingSchema>;
export type VerificationLog = z.infer<typeof VerificationLogSchema>;
export type VerificationLogsQuery = z.infer<typeof VerificationLogsQuerySchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
