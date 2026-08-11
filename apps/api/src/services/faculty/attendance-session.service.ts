import { AttendanceAggregationService } from "@webcampus/api/src/services/faculty/attendance-aggregation.service";
import {
  assertCanMutateAttendance,
  resolveFreezeState,
} from "@webcampus/api/src/services/faculty/freeze.service";
import { buildRegistrationWhere } from "@webcampus/api/src/services/shared/registration-helper.service";
import { logger } from "@webcampus/common/logger";
import { db, type Cycle, type Prisma } from "@webcampus/db";
import {
  CreateOrOpenFacultyAttendanceSessionType,
  DeleteFacultyAttendanceSessionParamsType,
  FacultyAttendanceSessionDetailQueryType,
  FacultyAttendanceSessionStudentsQueryType,
  FacultyAttendanceStudentStatusInputType,
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
  departmentId: string;
  cycle: string;
};

type FacultyElectiveBatchContext = {
  semester: number;
  academicYear: string;
  electiveBatchId: string;
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
  sectionId: string | null;
  batchId: string | null;
  electiveBatchId: string | null;
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
  } | null;
  Batch?: {
    name: string;
  } | null;
  electiveBatch?: {
    name: string;
  } | null;
}): FacultyAttendanceSessionDTO => {
  return {
    id: session.id,
    courseId: session.courseId,
    sectionId: session.sectionId ?? "",
    batchId: session.batchId ?? undefined,
    electiveBatchId: session.electiveBatchId ?? undefined,
    electiveBatchName: session.electiveBatch?.name ?? undefined,
    labBatchNumber: toLabBatchNumber(session.Batch?.name),
    sessionDate: session.sessionDate.toISOString(),
    timingCode: session.timingCode,
    timingLabel: session.timingLabel,
    timingStartTime: session.timingStartTime,
    timingEndTime: session.timingEndTime,
    courseCode: session.Course.code,
    courseName: session.Course.name,
    sectionName: session.electiveBatch?.name ?? session.Section?.name ?? "PE",
    createdAt: session.createdAt.toISOString(),
  };
};

const toSessionDtoFromScalars = (
  session: {
    id: string;
    courseId: string;
    sectionId: string | null;
    batchId: string | null;
    electiveBatchId: string | null;
    sessionDate: Date;
    timingCode: string;
    timingLabel: string;
    timingStartTime: string;
    timingEndTime: string;
    createdAt: Date;
  },
  courseMeta: { code: string; name: string } | undefined,
  sectionMeta: { name: string } | undefined,
  electiveBatchMeta: { name: string } | undefined
): FacultyAttendanceSessionDTO => {
  return {
    id: session.id,
    courseId: session.courseId,
    sectionId: session.sectionId ?? "",
    batchId: session.batchId ?? undefined,
    electiveBatchId: session.electiveBatchId ?? undefined,
    electiveBatchName: electiveBatchMeta?.name,
    sessionDate: session.sessionDate.toISOString(),
    timingCode: session.timingCode,
    timingLabel: session.timingLabel,
    timingStartTime: session.timingStartTime,
    timingEndTime: session.timingEndTime,
    courseCode: courseMeta?.code ?? session.courseId,
    courseName: courseMeta?.name ?? "Unknown Course",
    sectionName:
      electiveBatchMeta?.name ?? sectionMeta?.name ?? session.sectionId ?? "PE",
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
        section: {
          select: {
            departmentId: true,
            cycle: true,
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
      departmentId: assignment.section.departmentId,
      cycle: assignment.section.cycle,
    };
  }

  private static async getFacultyElectiveBatchContext(
    facultyId: string,
    courseId: string,
    electiveBatchId: string
  ): Promise<FacultyElectiveBatchContext> {
    const assignment = await db.electiveBatchFaculty.findFirst({
      where: {
        facultyId,
        courseId,
        electiveBatchId,
        course: {
          approvalStatus: "APPROVED",
        },
      },
      select: {
        semester: true,
        academicYear: true,
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
        "Forbidden: elective batch is not assigned to this faculty"
      );
    }

    return {
      semester: assignment.semester,
      academicYear: assignment.academicYear,
      electiveBatchId,
      semesterId: assignment.course.semesterId,
      academicTermId: assignment.course.semester.academicTermId,
    };
  }

  private static async getElectiveBatchRosterStudentIds(
    tx: Prisma.TransactionClient,
    courseId: string,
    electiveBatchId: string
  ): Promise<{ studentId: string }[]> {
    return tx.electiveStudentAssignment.findMany({
      where: {
        courseId,
        electiveBatchId,
      },
      select: { studentId: true },
    });
  }

  private static async getElectiveBatchRosterStudents(
    tx: Prisma.TransactionClient,
    courseId: string,
    electiveBatchId: string
  ): Promise<
    {
      studentId: string;
      usn: string;
      name: string;
    }[]
  > {
    const assignments = await tx.electiveStudentAssignment.findMany({
      where: {
        courseId,
        electiveBatchId,
      },
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

    return assignments.map((item) => ({
      studentId: item.student.id,
      usn: item.student.usn,
      name: item.student.user.name,
    }));
  }

  static async getSessionStudents(
    userId: string,
    query: FacultyAttendanceSessionStudentsQueryType
  ): Promise<BaseResponse<FacultyAttendanceSessionStudentsDTO>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);

      const isPeSession = Boolean(query.electiveBatchId);

      let students: {
        studentId: string;
        usn: string;
        name: string;
      }[];

      let attendanceFilter: {
        batchId: string | null;
        electiveBatchId?: string;
      };

      if (isPeSession) {
        const assignmentContext = await this.getFacultyElectiveBatchContext(
          facultyId,
          query.courseId,
          query.electiveBatchId as string
        );

        students = await this.getElectiveBatchRosterStudents(
          db,
          query.courseId,
          query.electiveBatchId as string
        );

        attendanceFilter = {
          batchId: null,
          electiveBatchId: assignmentContext.electiveBatchId,
        };
      } else {
        const assignmentContext = await this.getFacultyCourseSectionContext(
          facultyId,
          query.courseId,
          query.sectionId as string,
          query.batchId
        );

        const registrations = await db.courseRegistration.findMany({
          where: buildRegistrationWhere({
            courseId: query.courseId,
            semesterId: assignmentContext.semesterId,
            academicTermId: assignmentContext.academicTermId,
            sectionId: query.sectionId as string,
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

        students = registrations.map((item) => ({
          studentId: item.student.id,
          usn: item.student.usn,
          name: item.student.user.name,
        }));

        attendanceFilter = { batchId: assignmentContext.batchId ?? null };
      }

      const studentIds = students.map((student) => student.studentId);

      const attendanceRecords = await db.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          courseId: query.courseId,
          ...attendanceFilter, // Ensure lab vs theory vs elective batch split
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
          students: students.map((student) => {
            const attendance = attendanceMap.get(student.studentId);
            return {
              studentId: student.studentId,
              usn: student.usn,
              name: student.name,
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

      const electiveBatchAssignments = await db.electiveBatchFaculty.findMany({
        where: {
          facultyId,
          course: { approvalStatus: "APPROVED" },
        },
        select: {
          course: { select: { id: true, code: true, name: true } },
          electiveBatch: { select: { id: true, name: true } },
        },
      });

      for (const assignment of electiveBatchAssignments) {
        coursesMap.set(assignment.course.id, assignment.course);
      }

      return {
        status: "success",
        message: "Attendance filter options retrieved successfully",
        data: {
          courses: Array.from(coursesMap.values()),
          sections: Array.from(sectionsMap.values()),
          electiveBatches: electiveBatchAssignments.map((assignment) => ({
            id: assignment.electiveBatch.id,
            name: assignment.electiveBatch.name,
            courseId: assignment.course.id,
          })),
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
          electiveBatch: { select: { name: true } },
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
          ...(session.electiveBatchId
            ? {
                batchId: null,
                electiveBatchId: session.electiveBatchId,
              }
            : { batchId: session.batchId ?? null }), // Ensure lab vs theory vs elective batch split
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

  private static async upsertAttendanceRecords(
    tx: Prisma.TransactionClient,
    session: {
      id: string;
      courseId: string;
      batchId: string | null;
      electiveBatchId: string | null;
    },
    assignmentContext: FacultyCourseSectionAssignmentContext | null,
    payloadStudentStatuses: FacultyAttendanceStudentStatusInputType[],
    courseId: string,
    sectionId: string,
    batchId?: string
  ): Promise<{
    totalStudents: number;
    absentCount: number;
    presentCount: number;
  }> {
    const isPeSession = Boolean(session.electiveBatchId);

    let enrolledStudents: { studentId: string }[];

    if (isPeSession) {
      enrolledStudents = await this.getElectiveBatchRosterStudentIds(
        tx,
        courseId,
        session.electiveBatchId as string
      );
    } else {
      enrolledStudents = await tx.courseRegistration.findMany({
        where: buildRegistrationWhere({
          courseId,
          semesterId: assignmentContext!.semesterId,
          academicTermId: assignmentContext!.academicTermId,
          sectionId,
          batchId: batchId ?? undefined,
        }),
        select: { studentId: true },
      });
    }

    if (enrolledStudents.length === 0) {
      throw new Error("No students found in the selected section/batch");
    }

    const enrolledStudentIdSet = new Set(
      enrolledStudents.map((student) => student.studentId)
    );
    const explicitStatuses = payloadStudentStatuses ?? [];

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
        sessionId: session.id,
        studentId: statusItem.studentId,
        batchId: session.batchId,
        electiveBatchId: session.electiveBatchId,
        status: statusItem.status,
      })),
      skipDuplicates: true,
    });

    for (const [studentId, status] of explicitStatusMap.entries()) {
      await tx.attendanceRecord.upsert({
        where: {
          sessionId_studentId: { sessionId: session.id, studentId },
        },
        create: {
          id: crypto.randomUUID(),
          sessionId: session.id,
          studentId,
          batchId: session.batchId,
          electiveBatchId: session.electiveBatchId,
          status,
        },
        update: { status, markedAt: new Date() },
      });
    }

    await AttendanceAggregationService.aggregateAttendanceForCourse(
      session.courseId,
      tx
    );

    const absentCount = normalizedStatuses.reduce(
      (count, item) => (item.status === "ABSENT" ? count + 1 : count),
      0
    );
    const totalStudents = normalizedStatuses.length;

    return {
      totalStudents,
      absentCount,
      presentCount: totalStudents - absentCount,
    };
  }

  static async createSession(
    userId: string,
    payload: CreateOrOpenFacultyAttendanceSessionType
  ): Promise<BaseResponse<CreateOrOpenFacultyAttendanceSessionDTO>> {
    try {
      const { PeCapacityService } = await import(
        "@webcampus/api/src/services/shared/pe-capacity.service"
      );
      await PeCapacityService.assertPeDownstreamReady(payload.courseId);

      const facultyId = await this.getFacultyIdByUserId(userId);
      const isPeSession = Boolean(payload.electiveBatchId);

      let assignmentContext: FacultyCourseSectionAssignmentContext | null =
        null;

      if (isPeSession) {
        await this.getFacultyElectiveBatchContext(
          facultyId,
          payload.courseId,
          payload.electiveBatchId as string
        );
      } else {
        assignmentContext = await this.getFacultyCourseSectionContext(
          facultyId,
          payload.courseId,
          payload.sectionId as string,
          payload.batchId
        );
      }

      if (!isPeSession) {
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
      }

      const sessionDate = toSessionDateUtc(payload.sessionDate);
      const timing = getTimingWindow(payload);

      const today = toSessionDateUtc(new Date());
      if (!isPeSession && sessionDate.getTime() > today.getTime()) {
        const window = await db.bonusAttendanceWindow.findFirst({
          where: {
            academicTermId: assignmentContext!.academicTermId,
            semesterId: assignmentContext!.semesterId,
            isOpen: true,
            OR: [
              { departmentId: assignmentContext!.departmentId },
              { cycle: assignmentContext!.cycle as Cycle },
              { departmentId: null, cycle: null },
            ],
          },
          orderBy: { days: "desc" },
        });

        if (!window) {
          throw new Error("Cannot take attendance for future dates.");
        }

        const maxAllowedDate = new Date(today);
        maxAllowedDate.setUTCDate(maxAllowedDate.getUTCDate() + window.days);

        if (sessionDate.getTime() > maxAllowedDate.getTime()) {
          throw new Error(
            `Cannot take attendance beyond ${window.days} days in the future.`
          );
        }
      }

      // Strict check: existing session → 409 conflict
      const existingSession = await db.classSession.findFirst({
        where: {
          courseId: payload.courseId,
          ...(isPeSession
            ? { electiveBatchId: payload.electiveBatchId, sectionId: null }
            : {
                sectionId: payload.sectionId,
                batchId: payload.batchId ?? null,
              }),
          sessionDate,
          timingCode: timing.code,
        },
      });

      if (existingSession) {
        throw new Error(
          "Attendance already taken for this session. Please use Edit Attendance to modify it."
        );
      }

      // Overlap validation
      const potentialOverlaps = await db.classSession.findMany({
        where: {
          sessionDate,
          OR: [
            { facultyId },
            isPeSession
              ? { electiveBatchId: payload.electiveBatchId }
              : { sectionId: payload.sectionId },
          ],
        },
        select: {
          facultyId: true,
          sectionId: true,
          electiveBatchId: true,
          timingLabel: true,
          timingStartTime: true,
          timingEndTime: true,
        },
      });

      for (const overlapSession of potentialOverlaps) {
        if (
          hasTimeOverlap(
            timing.startTime,
            timing.endTime,
            overlapSession.timingStartTime,
            overlapSession.timingEndTime
          )
        ) {
          if (
            !isPeSession &&
            overlapSession.sectionId === payload.sectionId &&
            overlapSession.facultyId !== facultyId
          ) {
            throw new Error(
              `Section Overlap: Another faculty member is already conducting a session for this section at ${overlapSession.timingLabel}.`
            );
          }

          if (
            isPeSession &&
            overlapSession.electiveBatchId === payload.electiveBatchId &&
            overlapSession.facultyId !== facultyId
          ) {
            throw new Error(
              `Elective Batch Overlap: Another faculty member is already conducting a session for this batch at ${overlapSession.timingLabel}.`
            );
          }

          if (overlapSession.facultyId === facultyId) {
            throw new Error(
              `Faculty Overlap: You are already conducting a session at ${overlapSession.timingLabel}. You cannot take multiple classes at once.`
            );
          }
        }
      }

      const operationResult = await db.$transaction(async (tx) => {
        const targetSession = await tx.classSession.create({
          data: {
            id: crypto.randomUUID(),
            courseId: payload.courseId,
            sectionId: isPeSession ? null : payload.sectionId,
            facultyId,
            batchId: isPeSession ? null : (payload.batchId ?? null),
            electiveBatchId: isPeSession ? payload.electiveBatchId : null,
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
            electiveBatch: { select: { name: true } },
          },
        });

        const summary = await this.upsertAttendanceRecords(
          tx,
          targetSession,
          assignmentContext,
          payload.studentStatuses ?? [],
          payload.courseId,
          isPeSession ? "" : (payload.sectionId as string),
          payload.batchId
        );

        return { session: targetSession, ...summary };
      });

      return {
        status: "success",
        message: "Attendance session created successfully",
        data: {
          session: toSessionDto(operationResult.session),
          created: true,
          attendanceInitialization: {
            totalStudents: operationResult.totalStudents,
            presentCount: operationResult.presentCount,
            absentCount: operationResult.absentCount,
          },
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Failed to create attendance session");
    }
  }

  static async updateSession(
    userId: string,
    sessionId: string,
    studentStatuses: FacultyAttendanceStudentStatusInputType[]
  ): Promise<BaseResponse<CreateOrOpenFacultyAttendanceSessionDTO>> {
    try {
      const facultyId = await this.getFacultyIdByUserId(userId);

      const existingSession = await db.classSession.findUnique({
        where: { id: sessionId },
        include: {
          Course: { select: { code: true, name: true } },
          Section: { select: { name: true } },
          Batch: { select: { name: true } },
          electiveBatch: { select: { name: true } },
        },
      });

      if (!existingSession) {
        throw new Error("Attendance session not found");
      }

      if (existingSession.facultyId !== facultyId) {
        throw new Error("Forbidden: session not owned by faculty");
      }

      const isPeSession = Boolean(existingSession.electiveBatchId);

      const freezeCheck =
        !isPeSession && existingSession.sectionId
          ? await db.courseAssignment.findFirst({
              where: {
                courseId: existingSession.courseId,
                sectionId: existingSession.sectionId,
                batchId: existingSession.batchId,
                facultyId,
              },
              include: { freezes: true },
            })
          : null;
      if (freezeCheck)
        assertCanMutateAttendance(
          "faculty",
          resolveFreezeState(freezeCheck.freezes)
        );

      if (isPeSession) {
        await this.getFacultyElectiveBatchContext(
          facultyId,
          existingSession.courseId,
          existingSession.electiveBatchId as string
        );
      }

      const sectionId = existingSession.sectionId ?? "";

      const assignmentContext = isPeSession
        ? null
        : await this.getFacultyCourseSectionContext(
            facultyId,
            existingSession.courseId,
            sectionId,
            existingSession.batchId ?? undefined
          );

      const operationResult = await db.$transaction(async (tx) => {
        const { PeCapacityService } = await import(
          "@webcampus/api/src/services/shared/pe-capacity.service"
        );
        await PeCapacityService.assertPeDownstreamReady(
          existingSession.courseId,
          tx
        );

        const summary = await this.upsertAttendanceRecords(
          tx,
          existingSession,
          assignmentContext,
          studentStatuses ?? [],
          existingSession.courseId,
          sectionId,
          existingSession.batchId ?? undefined
        );

        return { session: existingSession, ...summary };
      });

      return {
        status: "success",
        message: "Attendance session updated successfully",
        data: {
          session: toSessionDto(operationResult.session),
          created: false,
          attendanceInitialization: {
            totalStudents: operationResult.totalStudents,
            presentCount: operationResult.presentCount,
            absentCount: operationResult.absentCount,
          },
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Failed to update attendance session");
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

        const { PeCapacityService } = await import(
          "@webcampus/api/src/services/shared/pe-capacity.service"
        );
        await PeCapacityService.assertPeDownstreamReady(session.courseId, tx);

        const freezeCheckDelete = session.sectionId
          ? await tx.courseAssignment.findFirst({
              where: {
                courseId: session.courseId,
                sectionId: session.sectionId,
                batchId: session.batchId,
                facultyId,
              },
              include: { freezes: true },
            })
          : null;

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
      if (query.electiveBatchId) where.electiveBatchId = query.electiveBatchId;

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
            electiveBatch: { select: { name: true } },
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
            electiveBatchId: true,
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
        const uniqueElectiveBatchIds = Array.from(
          new Set(
            scalarSessions
              .map((session) => session.electiveBatchId)
              .filter(isNonEmptyString)
          )
        );

        const [courses, sections, electiveBatches] = await Promise.all([
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
          uniqueElectiveBatchIds.length > 0
            ? db.electiveBatch.findMany({
                where: { id: { in: uniqueElectiveBatchIds } },
                select: { id: true, name: true },
              })
            : Promise.resolve([]),
        ]);

        const courseMap = new Map(courses.map((course) => [course.id, course]));
        const sectionMap = new Map(
          sections.map((section) => [section.id, section])
        );
        const electiveBatchMap = new Map(
          electiveBatches.map((batch) => [batch.id, batch])
        );

        items = scalarSessions.map((session) =>
          toSessionDtoFromScalars(
            session,
            courseMap.get(session.courseId),
            session.sectionId ? sectionMap.get(session.sectionId) : undefined,
            session.electiveBatchId
              ? electiveBatchMap.get(session.electiveBatchId)
              : undefined
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
