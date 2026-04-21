import { z } from "zod";

export const CondonationStatus = z.enum([
  "NOT_REQUESTED",
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const BaseAttendanceSchema = z.object({
  studentId: z.string("Invalid student ID"),
  courseId: z.string("Invalid course ID"),
  total: z
    .number()
    .int()
    .min(0, "Total classes must be a non-negative integer"),
  present: z
    .number()
    .int()
    .min(0, "Present classes must be a non-negative integer"),
  absent: z
    .number()
    .int()
    .min(0, "Absent classes must be a non-negative integer"),
  condonationStatus: CondonationStatus.default("NOT_REQUESTED"),
  percentage: z
    .number()
    .min(0)
    .max(100, "Percentage must be between 0 and 100"),
});

export const CreateAttendanceSchema = BaseAttendanceSchema;
export const UpdateAttendanceSchema = BaseAttendanceSchema.partial();

export const AttendanceResponseSchema = BaseAttendanceSchema.extend({
  id: z.string("Invalid attendance ID"),
});

const HHMM_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const FacultyFixedTimingCodeSchema = z.enum([
  "08:00-08:55",
  "08:55-09:50",
  "09:50-10:45",
  "11:15-12:10",
  "12:10-13:05",
  "14:00-14:55",
  "14:55-15:50",
  "15:50-16:45",
]);

export const AttendanceSessionTimingModeSchema = z.enum(["FIXED", "CUSTOM"]);
export const AttendanceRecordStatusSchema = z.enum(["PRESENT", "ABSENT"]);

export const FacultyAttendanceStudentStatusInputSchema = z.object({
  studentId: z.uuid("Invalid student ID"),
  status: AttendanceRecordStatusSchema,
});

export const CreateOrOpenFacultyAttendanceSessionSchema = z
  .object({
    courseId: z.uuid("Invalid course ID"),
    sectionId: z.uuid("Invalid section ID"),
    batchId: z.uuid("Invalid batch ID").optional(),
    sessionDate: z.coerce.date({
      error: "Invalid session date",
    }),
    timingMode: AttendanceSessionTimingModeSchema,
    timingCode: z.string().trim().optional(),
    timingStartTime: z.string().trim().optional(),
    timingEndTime: z.string().trim().optional(),
    studentStatuses: z
      .array(FacultyAttendanceStudentStatusInputSchema)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.timingMode === "FIXED") {
      if (!value.timingCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Timing code is required for fixed timing",
          path: ["timingCode"],
        });
        return;
      }

      if (!FacultyFixedTimingCodeSchema.safeParse(value.timingCode).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid fixed timing code",
          path: ["timingCode"],
        });
      }

      return;
    }

    if (
      !value.timingStartTime ||
      !HHMM_TIME_REGEX.test(value.timingStartTime)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom start time must be in HH:mm format",
        path: ["timingStartTime"],
      });
    }

    if (!value.timingEndTime || !HHMM_TIME_REGEX.test(value.timingEndTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom end time must be in HH:mm format",
        path: ["timingEndTime"],
      });
    }

    if (value.timingStartTime && value.timingEndTime) {
      const [startHour, startMinute] = value.timingStartTime
        .split(":")
        .map(Number) as [number, number];
      const [endHour, endMinute] = value.timingEndTime
        .split(":")
        .map(Number) as [number, number];
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;

      if (endTotalMinutes <= startTotalMinutes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom end time must be later than start time",
          path: ["timingEndTime"],
        });
      }
    }

    if (value.studentStatuses && value.studentStatuses.length > 0) {
      const seenStudentIds = new Set<string>();

      for (const [index, item] of value.studentStatuses.entries()) {
        if (seenStudentIds.has(item.studentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate studentId is not allowed in studentStatuses",
            path: ["studentStatuses", index, "studentId"],
          });
        }

        seenStudentIds.add(item.studentId);
      }
    }
  });

export const FacultyAttendanceSessionStudentsQuerySchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  sectionId: z.uuid("Invalid section ID"),
  batchId: z.uuid("Invalid batch ID").optional(),
});

export const FacultyAttendanceSessionDetailQuerySchema = z.object({
  sessionId: z.uuid("Invalid session ID"),
});

export const DeleteFacultyAttendanceSessionParamsSchema = z.object({
  sessionId: z.uuid("Invalid session ID"),
});

export const ListFacultyAttendanceSessionsQuerySchema = z.object({
  sessionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "sessionDate must be in YYYY-MM-DD format")
    .optional(),
  courseId: z.uuid("Invalid course ID").optional(),
  sectionId: z.uuid("Invalid section ID").optional(),
  batchId: z.uuid("Invalid batch ID").optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const FacultyAttendanceFilterOptionsResponseSchema = z.object({
  courses: z.array(
    z.object({
      id: z.uuid("Invalid course ID"),
      code: z.string(),
      name: z.string(),
    })
  ),
  sections: z.array(
    z.object({
      id: z.uuid("Invalid section ID"),
      name: z.string(),
      courseId: z.uuid("Invalid course ID"),
      assignmentType: z.enum(["THEORY", "LAB"]).optional(),
      batchId: z.uuid("Invalid batch ID").optional(),
      labBatchNumber: z.number().int().positive().optional(),
    })
  ),
});

export const FacultyAttendanceSessionResponseSchema = z.object({
  id: z.string(),
  courseId: z.uuid("Invalid course ID"),
  sectionId: z.uuid("Invalid section ID"),
  batchId: z.uuid("Invalid batch ID").optional(),
  labBatchNumber: z.number().int().positive().optional(),
  sessionDate: z.date(),
  timingCode: z.string(),
  timingLabel: z.string(),
  timingStartTime: z.string(),
  timingEndTime: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  sectionName: z.string(),
  createdAt: z.date(),
});

export const FacultyAttendanceSessionStudentResponseSchema = z.object({
  studentId: z.uuid("Invalid student ID"),
  usn: z.string(),
  name: z.string(),
  status: AttendanceRecordStatusSchema,
});

export const FacultyAttendanceSessionInitializationSummarySchema = z.object({
  totalStudents: z.number().int().nonnegative(),
  presentCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
});

export const CreateOrOpenFacultyAttendanceSessionResponseSchema = z.object({
  session: FacultyAttendanceSessionResponseSchema,
  created: z.boolean(),
  attendanceInitialization: FacultyAttendanceSessionInitializationSummarySchema,
});

export const FacultyAttendanceSessionStudentsResponseSchema = z.object({
  students: z.array(FacultyAttendanceSessionStudentResponseSchema),
});

export const FacultyAttendanceSessionDetailResponseSchema = z.object({
  session: FacultyAttendanceSessionResponseSchema,
  students: z.array(FacultyAttendanceSessionStudentResponseSchema),
});

export type BaseAttendanceType = z.infer<typeof BaseAttendanceSchema>;
export type CreateAttendanceType = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendanceType = z.infer<typeof UpdateAttendanceSchema>;
export type AttendanceResponseType = z.infer<typeof AttendanceResponseSchema>;
export type FacultyFixedTimingCodeType = z.infer<
  typeof FacultyFixedTimingCodeSchema
>;
export type AttendanceSessionTimingModeType = z.infer<
  typeof AttendanceSessionTimingModeSchema
>;
export type AttendanceRecordStatusType = z.infer<
  typeof AttendanceRecordStatusSchema
>;
export type FacultyAttendanceStudentStatusInputType = z.infer<
  typeof FacultyAttendanceStudentStatusInputSchema
>;
export type CreateOrOpenFacultyAttendanceSessionType = z.infer<
  typeof CreateOrOpenFacultyAttendanceSessionSchema
>;
export type FacultyAttendanceSessionStudentsQueryType = z.infer<
  typeof FacultyAttendanceSessionStudentsQuerySchema
>;
export type FacultyAttendanceSessionDetailQueryType = z.infer<
  typeof FacultyAttendanceSessionDetailQuerySchema
>;
export type DeleteFacultyAttendanceSessionParamsType = z.infer<
  typeof DeleteFacultyAttendanceSessionParamsSchema
>;
export type ListFacultyAttendanceSessionsQueryType = z.infer<
  typeof ListFacultyAttendanceSessionsQuerySchema
>;
export type FacultyAttendanceFilterOptionsResponseType = z.infer<
  typeof FacultyAttendanceFilterOptionsResponseSchema
>;
export type FacultyAttendanceSessionResponseType = z.infer<
  typeof FacultyAttendanceSessionResponseSchema
>;
export type FacultyAttendanceSessionStudentResponseType = z.infer<
  typeof FacultyAttendanceSessionStudentResponseSchema
>;
export type FacultyAttendanceSessionInitializationSummaryType = z.infer<
  typeof FacultyAttendanceSessionInitializationSummarySchema
>;
export type CreateOrOpenFacultyAttendanceSessionResponseType = z.infer<
  typeof CreateOrOpenFacultyAttendanceSessionResponseSchema
>;
export type FacultyAttendanceSessionStudentsResponseType = z.infer<
  typeof FacultyAttendanceSessionStudentsResponseSchema
>;
export type FacultyAttendanceSessionDetailResponseType = z.infer<
  typeof FacultyAttendanceSessionDetailResponseSchema
>;
