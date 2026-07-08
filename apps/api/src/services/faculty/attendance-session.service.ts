import { AttendanceAggregationService } from "@webcampus/api/src/services/faculty/attendance-aggregation.service";
import {
  assertCanMutateAttendance,
  resolveFreezeState,
} from "@webcampus/api/src/services/faculty/freeze.service";
import { buildRegistrationWhere } from "@webcampus/api/src/services/shared/registration-helper.service";
import { logger } from "@webcampus/common/logger";
import { db, type Prisma } from "@webcampus/db";
import {
  CreateOrOpenFacultyAttendanceSessionType,
  DeleteFacultyAttendanceSessionParamsType,
  FacultyAttendanceSessionDetailQueryType,
  FacultyAttendanceSessionStudentsQueryType,
  ListFacultyAttendanceSessionsQueryType,
} from "@webcampus/schemas/faculty";
import {
  AttendanceRecordStatusDTO,
  BaseResponse,
  CreateOrOpenFacultyAttendanceSessionDTO,
  DeleteFacultyAttendanceSessionDTO,
  FacultyAttendanceFilterOptionsDTO,
  FacultyAttendanceSessionDetailDTO,
  FacultyAttendanceSessionDTO,
  FacultyAttendanceSessionStudentsDTO,
  PaginatedResponse,
} from "@webcampus/types/api";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

type TimingWindow = {
  code: string;
  startTime: string;
  endTime: string;
  label: string;
};

type FacultyCourseSectionAssignmentContext = {
  semester: number;
  academicYear: string;
  assignmentType: "THEORY" | "LAB";
  batchId: string | null;
  semesterId: string;
  academicTermId: string;
};

const toLabBatchNumber = (
  batchName: string | null | undefined
): number | undefined => {
  if (!batchName) {
    return undefined;
  }

  const match = batchName.match(/(\d+)/);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const FIXED_TIMING_WINDOWS: Record<string, TimingWindow> = {
  "08:00-08:55": {
    code: "08:00-08:55",
    startTime: "08:00",
    endTime: "08:55",
    label: "08:00 AM - 08:55 AM",
  },
  "08:55-09:50": {
    code: "08:55-09:50",
    startTime: "08:55",
    endTime: "09:50",
    label: "08:55 AM - 09:50 AM",
  },
  "09:50-10:45": {
    code: "09:50-10:45",
    startTime: "09:50",
    endTime: "10:45",
    label: "09:50 AM - 10:45 AM",
  },
  "11:15-12:10": {
    code: "11:15-12:10",
    startTime: "11:15",
    endTime: "12:10",
    label: "11:15 AM - 12:10 PM",
  },
  "12:10-13:05": {
    code: "12:10-13:05",
    startTime: "12:10",
    endTime: "13:05",
    label: "12:10 PM - 01:05 PM",
  },
  "14:00-14:55": {
    code: "14:00-14:55",
    startTime: "14:00",
    endTime: "14:55",
    label: "02:00 PM - 02:55 PM",
  },
  "14:55-15:50": {
    code: "14:55-15:50",
    startTime: "14:55",
    endTime: "15:50",
    label: "02:55 PM - 03:50 PM",
  },
  "15:50-16:45": {
    code: "15:50-16:45",
    startTime: "15:50",
    endTime: "16:45",
    label: "03:50 PM - 04:45 PM",
  },

  // DYNAMIC LAB BATCHES SUPPORT (2-hour combinations)
  "08:00-09:50": {
    code: "08:00-09:50",
    startTime: "08:00",
    endTime: "09:50",
    label: "08:00 AM - 09:50 AM",
  },
  "08:55-10:45": {
    code: "08:55-10:45",
    startTime: "08:55",
    endTime: "10:45",
    label: "08:55 AM - 10:45 AM",
  },
  "11:15-13:05": {
    code: "11:15-13:05",
    startTime: "11:15",
    endTime: "13:05",
    label: "11:15 AM - 01:05 PM",
  },
  "14:00-15:50": {
    code: "14:00-15:50",
    startTime: "14:00",
    endTime: "15:50",
    label: "02:00 PM - 03:50 PM",
  },
  "14:55-16:45": {
    code: "14:55-16:45",
    startTime: "14:55",
    endTime: "16:45",
    label: "02:55 PM - 04:45 PM",
  },
};

const toSessionDateUtc = (sessionDate: Date): Date => {
  const utcYear = sessionDate.getUTCFullYear();
  const utcMonth = sessionDate.getUTCMonth();
  const utcDay = sessionDate.getUTCDate();
  return new Date(Date.UTC(utcYear, utcMonth, utcDay));
};

const toCustomLabel = (startTime: string, endTime: string): string => {
  return `${startTime} - ${endTime}`;
};

const toMinutes = (value: string): number => {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Invalid timing value");
  }

  return hour * 60 + minute;
};

const hasTimeOverlap = (
  startTime: string,
  endTime: string,
  existingStartTime: string,
  existingEndTime: string
): boolean => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const existingStart = toMinutes(existingStartTime);
  const existingEnd = toMinutes(existingEndTime);

  // TRUE overlap occurs if start is strictly before existing end AND end is strictly after existing start.
  return start < existingEnd && end > existingStart;
};

const toSessionDto = (session: {
  id: string;
  courseId: string;
  sectionId: string;
  batchId: string | null;
  sessionDate: Date;
  timingCode: string;
  timingLabel: string;
  timingStartTime: string;
  timingEndTime: string;
  createdAt: Date;
  Course: {
    code: string;
    name: string;
  };
  Section: {
    name: string;
  };
  Batch?: {
    name: string;
  } | null;
}): FacultyAttendanceSessionDTO => {
  return {
    id: session.id,
    courseId: session.courseId,
    sectionId: session.sectionId,
    batchId: session.batchId ?? undefined,
    labBatchNumber: toLabBatchNumber(session.Batch?.name),
    sessionDate: session.sessionDate.toISOString(),
    timingCode: session.timingCode,
    timingLabel: session.timingLabel,
    timingStartTime: session.timingStartTime,
    timingEndTime: session.timingEndTime,
    courseCode: session.Course.code,
    courseName: session.Course.name,
    sectionName: session.Section.name,
    createdAt: session.createdAt.toISOString(),
  };
};

const toSessionDtoFromScalars = (
  session: {
    id: string;
    courseId: string;
    sectionId: string;
    batchId: string | null;
    sessionDate: Date;
    timingCode: string;
    timingLabel: string;
    timingStartTime: string;
    timingEndTime: string;
    createdAt: Date;
  },
  courseMeta: { code: string; name: string } | undefined,
  sectionMeta: { name: string } | undefined
): FacultyAttendanceSessionDTO => {
  return {
    id: session.id,
    courseId: session.courseId,
    sectionId: session.sectionId,
    batchId: session.batchId ?? undefined,
    sessionDate: session.sessionDate.toISOString(),
    timingCode: session.timingCode,
    timingLabel: session.timingLabel,
    timingStartTime: session.timingStartTime,
    timingEndTime: session.timingEndTime,
    courseCode: courseMeta?.code ?? session.courseId,
    courseName: courseMeta?.name ?? "Unknown Course",
    sectionName: sectionMeta?.name ?? session.sectionId,
    createdAt: session.createdAt.toISOString(),
  };
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const toSafePositiveInt = (
  value: unknown,
  fallback: number,
  maximum?: number
): number => {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  const truncated = Math.trunc(numericValue);
  if (maximum && truncated > maximum) {
    return maximum;
  }

  return truncated;
};

const getTimingWindow = (
  payload: CreateOrOpenFacultyAttendanceSessionType
): TimingWindow => {
  if (payload.timingMode === "FIXED") {
    const slot = payload.timingCode
      ? FIXED_TIMING_WINDOWS[payload.timingCode]
      : null;
    if (!slot) {
      throw new Error("Invalid fixed timing slot");
    }

    return slot;
  }

  if (!payload.timingStartTime || !payload.timingEndTime) {
    throw new Error("Custom timing start and end are required");
  }

  return {
    code: `${payload.timingStartTime}-${payload.timingEndTime}`,
    startTime: payload.timingStartTime,
    endTime: payload.timingEndTime,
    label: toCustomLabel(payload.timingStartTime, payload.timingEndTime),
  };
};

export class FacultyAttendanceSessionService {
  private static async getFacultyIdByUserId(userId: string): Promise<string> {
    logger.info("getFacultyIdByUserId: looking up faculty for userId", {
      userId,
    });
    const faculty = await db.faculty.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!faculty) {
      throw new Error("Faculty profile not found");
    }
    return faculty.id;
  }

  private static async getFacultyCourseSectionContext(
    facultyId: string,
    courseId: string,
    sectionId: string,
    batchId?: string
  ): Promise<FacultyCourseSectionAssignmentContext> {
    const assignment = await db.courseAssignment.findFirst({
      where: {
        facultyId,
        courseId,
        sectionId,
        assignmentType: batchId ? "LAB" : "THEORY",
        ...(batchId ? { batchId } : {}),
        course: {
          approvalStatus: "APPROVED",
        },
      },
      select: {
        id: true,
        semester: true,
        academicYear: true,
        assignmentType: true,
        batchId: true,
        course: {
          select: {
            semesterId: true,
            semester: {
              select: {
                academicTermId: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new Error(
        "Forbidden: course-section is not assigned to this faculty"
      );
    }

    return {
      semester: assignment.semester,
      academicYear: assignment.academicYear,
      assignmentType: assignment.assignmentType,
      batchId: assignment.batchId,
      semesterId: assignment.course.semesterId,
      academicTermId: assignment.course.semester.academicTermId,
    };
  }

  static async getSessionStudents(
    userId: string,
    query: FacultyAttendanceSessionStudentsQueryType
  ): Promise<BaseResponse<FacultyAttendanceSessionStudentsDTO>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);
      const assignmentContext = await this.getFacultyCourseSectionContext(
        facultyId,
        query.courseId,
        query.sectionId,
        query.batchId
      );

      const students = await db.courseRegistration.findMany({
        where: buildRegistrationWhere({
          courseId: query.courseId,
          semesterId: assignmentContext.semesterId,
          academicTermId: assignmentContext.academicTermId,
          sectionId: query.sectionId,
          batchId:
            assignmentContext.assignmentType === "LAB"
              ? (assignmentContext.batchId ?? undefined)
              : undefined,
        }),
        orderBy: { student: { usn: "asc" } },
        select: {
          student: {
            select: {
              id: true,
              usn: true,
              user: { select: { name: true } },
            },
          },
        },
      });

      const studentIds = students.map((item) => item.student.id);

      const attendanceRecords = await db.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          courseId: query.courseId,
          batchId: assignmentContext.batchId ?? null, // Ensure lab vs theory split
        },
        select: {
          studentId: true,
          total: true,
          present: true,
          percentage: true,
        },
      });

      const attendanceMap = new Map(
        attendanceRecords.map((record) => [record.studentId, record])
      );

      return {
        status: "success",
        message: "Session students retrieved successfully",
        data: {
          students: students.map((item) => {
            const attendance = attendanceMap.get(item.student.id);
            return {
              studentId: item.student.id,
              usn: item.student.usn,
              name: item.student.user.name,
              status: "PRESENT",
              previousAttendancePercentage:
                attendance && attendance.total > 0
                  ? Math.round(attendance.percentage)
                  : undefined,
            };
          }),
        },
      };
    } catch (error) {
      logger.error("Error", { error });
      throw new Error("Failed to retrieve session students");
    }
  }

  static async getFilterOptions(
    userId: string
  ): Promise<BaseResponse<FacultyAttendanceFilterOptionsDTO>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);

      const assignments = await db.courseAssignment.findMany({
        where: {
          facultyId,
          assignmentType: { in: ["THEORY", "LAB"] },
          course: { approvalStatus: "APPROVED" },
        },
        select: {
          assignmentType: true,
          batchId: true,
          batch: { select: { name: true } },
          course: { select: { id: true, code: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      });

      const coursesMap = new Map<
        string,
        { id: string; code: string; name: string }
      >();
      const sectionsMap = new Map<
        string,
        {
          id: string;
          name: string;
          courseId: string;
          assignmentType?: "THEORY" | "LAB";
          batchId?: string;
          labBatchNumber?: number;
        }
      >();

      for (const assignment of assignments) {
        coursesMap.set(assignment.course.id, assignment.course);
        sectionsMap.set(
          `${assignment.section.id}:${assignment.course.id}:${assignment.batchId ?? "theory"}`,
          {
            id: assignment.section.id,
            name: assignment.section.name,
            courseId: assignment.course.id,
            assignmentType: assignment.assignmentType,
            batchId: assignment.batchId ?? undefined,
            labBatchNumber: toLabBatchNumber(assignment.batch?.name),
          }
        );
      }

      return {
        status: "success",
        message: "Attendance filter options retrieved successfully",
        data: {
          courses: Array.from(coursesMap.values()),
          sections: Array.from(sectionsMap.values()),
        },
      };
    } catch (error) {
      logger.error("Error", { error });
      throw new Error("Failed to retrieve attendance filter options");
    }
  }

  static async getSessionDetail(
    userId: string,
    query: FacultyAttendanceSessionDetailQueryType
  ): Promise<BaseResponse<FacultyAttendanceSessionDetailDTO>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);

      const session = await db.classSession.findUnique({
        where: { id: query.sessionId },
        include: {
          Course: { select: { code: true, name: true } },
          Section: { select: { name: true } },
          Batch: { select: { name: true } },
          AttendanceRecord: {
            select: {
              studentId: true,
              status: true,
              Student: {
                select: { usn: true, user: { select: { name: true } } },
              },
            },
          },
        },
      });

      if (!session) throw new Error("Attendance session not found");
      if (session.facultyId !== facultyId)
        throw new Error("Forbidden: session not owned by faculty");

      const studentIds = session.AttendanceRecord.map(
        (record) => record.studentId
      );
      const attendanceRecords = await db.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          courseId: session.courseId,
          batchId: session.batchId ?? null, // Ensure lab vs theory split
        },
        select: {
          studentId: true,
          total: true,
          present: true,
          percentage: true,
        },
      });

      const attendanceMap = new Map(
        attendanceRecords.map((record) => [record.studentId, record])
      );

      return {
        status: "success",
        message: "Attendance session detail retrieved successfully",
        data: {
          session: toSessionDto(session),
          students: session.AttendanceRecord.map((record) => {
            const attendance = attendanceMap.get(record.studentId);
            return {
              studentId: record.studentId,
              usn: record.Student.usn,
              name: record.Student.user.name,
              status: record.status,
              previousAttendancePercentage:
                attendance && attendance.total > 0
                  ? Math.round(attendance.percentage)
                  : undefined,
            };
          }).sort((left, right) => left.usn.localeCompare(right.usn)),
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Failed to retrieve attendance session detail");
    }
  }

  static async createOrOpenSession(
    userId: string,
    payload: CreateOrOpenFacultyAttendanceSessionType
  ): Promise<BaseResponse<CreateOrOpenFacultyAttendanceSessionDTO>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);
      const assignmentContext = await this.getFacultyCourseSectionContext(
        facultyId,
        payload.courseId,
        payload.sectionId,
        payload.batchId
      );

      const freezeCheck = await db.courseAssignment.findFirst({
        where: {
          courseId: payload.courseId,
          sectionId: payload.sectionId,
          batchId: payload.batchId ?? null,
          facultyId,
        },
        include: { freezes: true },
      });
      if (freezeCheck)
        assertCanMutateAttendance(
          "faculty",
          resolveFreezeState(freezeCheck.freezes)
        );

      const sessionDate = toSessionDateUtc(payload.sessionDate);
      const timing = getTimingWindow(payload);

      // 1. Is this specific exact session already open?
      const existingSession = await db.classSession.findFirst({
        where: {
          courseId: payload.courseId,
          sectionId: payload.sectionId,
          batchId: payload.batchId ?? null,
          sessionDate,
          timingCode: timing.code,
        },
        include: {
          Course: { select: { code: true, name: true } },
          Section: { select: { name: true } },
          Batch: { select: { name: true } },
        },
      });

      // Validating overlaps ONLY if this is a brand new session creation
      if (!existingSession) {
        // 2. Fetch ALL sessions for this day that either share the same Faculty or the same Section
        const potentialOverlaps = await db.classSession.findMany({
          where: {
            sessionDate,
            OR: [
              { facultyId }, // To check Faculty Overlap
              { sectionId: payload.sectionId }, // To check Section Overlap
            ],
          },
          select: {
            facultyId: true,
            sectionId: true,
            timingLabel: true,
            timingStartTime: true,
            timingEndTime: true,
          },
        });

        // 3. Evaluate overlapping time constraints
        for (const overlapSession of potentialOverlaps) {
          if (
            hasTimeOverlap(
              timing.startTime,
              timing.endTime,
              overlapSession.timingStartTime,
              overlapSession.timingEndTime
            )
          ) {
            // Overlap Rule 1: Same Section, Different Faculty
            if (
              overlapSession.sectionId === payload.sectionId &&
              overlapSession.facultyId !== facultyId
            ) {
              throw new Error(
                `Section Overlap: Another faculty member is already conducting a session for this section at ${overlapSession.timingLabel}.`
              );
            }

            // Overlap Rule 2: Same Faculty, Different Section (or same section but time intersects weirdly)
            if (overlapSession.facultyId === facultyId) {
              throw new Error(
                `Faculty Overlap: You are already conducting a session at ${overlapSession.timingLabel}. You cannot take multiple classes at once.`
              );
            }
          }
        }
      } else if (existingSession.facultyId !== facultyId) {
        throw new Error(
          "A session already exists for this exact slot and is not owned by you."
        );
      }

      const operationResult = await db.$transaction(async (tx) => {
        const targetSession =
          existingSession ??
          (await tx.classSession.create({
            data: {
              id: crypto.randomUUID(),
              courseId: payload.courseId,
              sectionId: payload.sectionId,
              facultyId,
              batchId: payload.batchId ?? null,
              sessionDate,
              timingCode: timing.code,
              timingLabel: timing.label,
              timingStartTime: timing.startTime,
              timingEndTime: timing.endTime,
            },
            include: {
              Course: { select: { code: true, name: true } },
              Section: { select: { name: true } },
              Batch: { select: { name: true } },
            },
          }));

        const enrolledStudents = await tx.courseRegistration.findMany({
          where: buildRegistrationWhere({
            courseId: payload.courseId,
            semesterId: assignmentContext.semesterId,
            academicTermId: assignmentContext.academicTermId,
            sectionId: payload.sectionId,
            batchId: payload.batchId ?? undefined,
          }),
          select: { studentId: true },
        });

        if (enrolledStudents.length === 0)
          throw new Error("No students found in the selected section/batch");

        const enrolledStudentIdSet = new Set(
          enrolledStudents.map((student) => student.studentId)
        );
        const explicitStatuses = payload.studentStatuses ?? [];

        for (const item of explicitStatuses) {
          if (!enrolledStudentIdSet.has(item.studentId)) {
            throw new Error(
              "One or more students do not belong to the selected section/batch"
            );
          }
        }

        const explicitStatusMap = new Map(
          explicitStatuses.map((item) => [item.studentId, item.status] as const)
        );
        const normalizedStatuses = enrolledStudents.map((student) => ({
          studentId: student.studentId,
          status:
            (explicitStatusMap.get(student.studentId) as
              | AttendanceRecordStatusDTO
              | undefined) ?? "PRESENT",
        }));

        await tx.attendanceRecord.createMany({
          data: normalizedStatuses.map((statusItem) => ({
            id: crypto.randomUUID(),
            sessionId: targetSession.id,
            studentId: statusItem.studentId,
            batchId: targetSession.batchId, // NEW SCHEMA REQUIREMENT
            status: statusItem.status,
          })),
          skipDuplicates: true,
        });

        for (const [studentId, status] of explicitStatusMap.entries()) {
          await tx.attendanceRecord.upsert({
            where: {
              sessionId_studentId: { sessionId: targetSession.id, studentId },
            },
            create: {
              id: crypto.randomUUID(),
              sessionId: targetSession.id,
              studentId,
              batchId: targetSession.batchId, // NEW SCHEMA REQUIREMENT
              status,
            },
            update: { status, markedAt: new Date() },
          });
        }

        // Aggregate attendance logic for BOTH theory and lab
        await AttendanceAggregationService.aggregateAttendanceForCourse(
          targetSession.courseId,
          tx
        );

        const absentCount = normalizedStatuses.reduce(
          (count, item) => (item.status === "ABSENT" ? count + 1 : count),
          0
        );
        const totalStudents = normalizedStatuses.length;

        return {
          session: targetSession,
          created: !existingSession,
          attendanceInitialization: {
            totalStudents,
            absentCount,
            presentCount: totalStudents - absentCount,
          },
        };
      });

      return {
        status: "success",
        message: operationResult.created
          ? "Attendance session created successfully"
          : "Attendance session updated successfully",
        data: {
          session: toSessionDto(operationResult.session),
          created: operationResult.created,
          attendanceInitialization: operationResult.attendanceInitialization,
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Failed to create attendance session");
    }
  }

  static async deleteSession(
    userId: string,
    params: DeleteFacultyAttendanceSessionParamsType
  ): Promise<BaseResponse<DeleteFacultyAttendanceSessionDTO>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);

      const deletedSummary = await db.$transaction(async (tx) => {
        const session = await tx.classSession.findUnique({
          where: { id: params.sessionId },
          include: { AttendanceRecord: { select: { studentId: true } } },
        });

        if (!session) throw new Error("Attendance session not found");
        if (session.facultyId !== facultyId)
          throw new Error(
            "Forbidden: attendance session is not owned by this faculty"
          );

        const freezeCheckDelete = await tx.courseAssignment.findFirst({
          where: {
            courseId: session.courseId,
            sectionId: session.sectionId,
            batchId: session.batchId,
            facultyId,
          },
          include: { freezes: true },
        });

        if (freezeCheckDelete) {
          assertCanMutateAttendance(
            "faculty",
            resolveFreezeState(freezeCheckDelete.freezes)
          );
        }

        const affectedStudentIds = Array.from(
          new Set(session.AttendanceRecord.map((record) => record.studentId))
        );

        await tx.classSession.delete({ where: { id: session.id } });

        for (const studentId of affectedStudentIds) {
          await AttendanceAggregationService.aggregateAttendanceForStudentCourse(
            studentId,
            session.courseId,
            tx
          );
        }

        return {
          sessionId: session.id,
          courseId: session.courseId,
          affectedStudentCount: affectedStudentIds.length,
        };
      });

      return {
        status: "success",
        message: "Attendance session deleted successfully",
        data: deletedSummary,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Failed to delete attendance session");
    }
  }

  static async listSessions(
    userId: string,
    query: ListFacultyAttendanceSessionsQueryType
  ): Promise<BaseResponse<PaginatedResponse<FacultyAttendanceSessionDTO>>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);
      const page = toSafePositiveInt(query.page, DEFAULT_PAGE);
      const limit = toSafePositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT);

      const where: Prisma.ClassSessionWhereInput = { facultyId };
      if (query.courseId) where.courseId = query.courseId;
      if (query.sectionId) where.sectionId = query.sectionId;
      if (query.batchId) where.batchId = query.batchId;

      if (query.sessionDate) {
        const dayStart = new Date(`${query.sessionDate}T00:00:00.000Z`);
        const nextDayStart = new Date(`${query.sessionDate}T00:00:00.000Z`);
        nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);
        where.sessionDate = { gte: dayStart, lt: nextDayStart };
      }

      const total = await db.classSession.count({ where });
      let items: FacultyAttendanceSessionDTO[];

      try {
        const sessions = await db.classSession.findMany({
          where,
          orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            Course: { select: { code: true, name: true } },
            Section: { select: { name: true } },
            Batch: { select: { name: true } },
          },
        });

        items = sessions.map(toSessionDto);
      } catch (includeError) {
        logger.error("Error", { includeError });
        const scalarSessions = await db.classSession.findMany({
          where,
          orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            courseId: true,
            sectionId: true,
            batchId: true,
            sessionDate: true,
            timingCode: true,
            timingLabel: true,
            timingStartTime: true,
            timingEndTime: true,
            createdAt: true,
          },
        });

        const uniqueCourseIds = Array.from(
          new Set(
            scalarSessions
              .map((session) => session.courseId)
              .filter(isNonEmptyString)
          )
        );
        const uniqueSectionIds = Array.from(
          new Set(
            scalarSessions
              .map((session) => session.sectionId)
              .filter(isNonEmptyString)
          )
        );

        const [courses, sections] = await Promise.all([
          uniqueCourseIds.length > 0
            ? db.course.findMany({
                where: { id: { in: uniqueCourseIds } },
                select: { id: true, code: true, name: true },
              })
            : Promise.resolve([]),
          uniqueSectionIds.length > 0
            ? db.section.findMany({
                where: { id: { in: uniqueSectionIds } },
                select: { id: true, name: true },
              })
            : Promise.resolve([]),
        ]);

        const courseMap = new Map(courses.map((course) => [course.id, course]));
        const sectionMap = new Map(
          sections.map((section) => [section.id, section])
        );

        items = scalarSessions.map((session) =>
          toSessionDtoFromScalars(
            session,
            courseMap.get(session.courseId),
            sectionMap.get(session.sectionId)
          )
        );
      }

      const totalPages = Math.max(1, Math.ceil(total / limit));
      return {
        status: "success",
        message: "Attendance sessions retrieved successfully",
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        },
      };
    } catch (error) {
      logger.error("Error", { error });
      throw new Error("Failed to retrieve attendance sessions");
    }
  }
}
