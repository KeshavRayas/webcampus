import { logger } from "@webcampus/common/logger";
import { db, type Prisma } from "@webcampus/db";
import {
  CreateOrOpenFacultyAttendanceSessionType,
  FacultyAttendanceSessionDetailQueryType,
  FacultyAttendanceSessionStudentsQueryType,
  ListFacultyAttendanceSessionsQueryType,
} from "@webcampus/schemas/faculty";
import {
  AttendanceRecordStatusDTO,
  BaseResponse,
  CreateOrOpenFacultyAttendanceSessionDTO,
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

  return start < existingEnd && end > existingStart;
};

const toSessionDto = (
  session: {
    id: string;
    courseId: string;
    sectionId: string;
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
  }
): FacultyAttendanceSessionDTO => {
  return {
    id: session.id,
    courseId: session.courseId,
    sectionId: session.sectionId,
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
    const slot = payload.timingCode ? FIXED_TIMING_WINDOWS[payload.timingCode] : null;
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
    sectionId: string
  ): Promise<FacultyCourseSectionAssignmentContext> {
    const assignment = await db.courseAssignment.findFirst({
      where: {
        facultyId,
        courseId,
        sectionId,
        assignmentType: "THEORY",
        course: {
          approvalStatus: "APPROVED",
        },
      },
      select: {
        id: true,
        semester: true,
        academicYear: true,
      },
    });

    if (!assignment) {
      throw new Error("Forbidden: course-section is not assigned to this faculty");
    }

    return {
      semester: assignment.semester,
      academicYear: assignment.academicYear,
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
        query.sectionId
      );

      const students = await db.studentSection.findMany({
        where: {
          sectionId: query.sectionId,
          semester: assignmentContext.semester,
          academicYear: assignmentContext.academicYear,
        },
        orderBy: {
          student: {
            usn: "asc",
          },
        },
        select: {
          student: {
            select: {
              id: true,
              usn: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      return {
        status: "success",
        message: "Session students retrieved successfully",
        data: {
          students: students.map((item) => ({
            studentId: item.student.id,
            usn: item.student.usn,
            name: item.student.user.name,
            status: "PRESENT",
          })),
        },
      };
    } catch (error) {
      logger.error("Error fetching faculty attendance session students", { error });
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
          assignmentType: "THEORY",
          course: {
            approvalStatus: "APPROVED",
          },
        },
        select: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const coursesMap = new Map<string, { id: string; code: string; name: string }>();
      const sectionsMap = new Map<
        string,
        { id: string; name: string; courseId: string }
      >();

      for (const assignment of assignments) {
        coursesMap.set(assignment.course.id, assignment.course);
        sectionsMap.set(`${assignment.section.id}:${assignment.course.id}`, {
          id: assignment.section.id,
          name: assignment.section.name,
          courseId: assignment.course.id,
        });
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
      logger.error("Error fetching faculty attendance filter options", { error });
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
        where: {
          id: query.sessionId,
        },
        include: {
          Course: {
            select: {
              code: true,
              name: true,
            },
          },
          Section: {
            select: {
              name: true,
            },
          },
          AttendanceRecord: {
            select: {
              studentId: true,
              status: true,
              Student: {
                select: {
                  usn: true,
                  user: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new Error("Attendance session not found");
      }

      if (session.facultyId !== facultyId) {
        throw new Error("Forbidden: attendance session is not owned by this faculty");
      }

      return {
        status: "success",
        message: "Attendance session detail retrieved successfully",
        data: {
          session: toSessionDto(session),
          students: session.AttendanceRecord.map((record) => ({
            studentId: record.studentId,
            usn: record.Student.usn,
            name: record.Student.user.name,
            status: record.status,
          })).sort((left, right) => left.usn.localeCompare(right.usn)),
        },
      };
    } catch (error) {
      logger.error("Error retrieving faculty attendance session detail", {
        error,
      });
      if (error instanceof Error) {
        throw error;
      }
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
        payload.sectionId
      );

      const sessionDate = toSessionDateUtc(payload.sessionDate);
      const timing = getTimingWindow(payload);

      const existingSession = await db.classSession.findUnique({
        where: {
          courseId_sectionId_sessionDate_timingCode: {
            courseId: payload.courseId,
            sectionId: payload.sectionId,
            sessionDate,
            timingCode: timing.code,
          },
        },
        include: {
          Course: {
            select: {
              code: true,
              name: true,
            },
          },
          Section: {
            select: {
              name: true,
            },
          },
        },
      });
      if (existingSession && existingSession.facultyId !== facultyId) {
        return {
          status: "error",
          message: "A session already exists for this slot and is not owned by you",
          error: "Session ownership mismatch",
        };
      }

      if (!existingSession) {
        const overlappingSession = await db.classSession.findFirst({
          where: {
            sessionDate,
            OR: [
              {
                facultyId,
              },
              {
                sectionId: payload.sectionId,
              },
            ],
            timingStartTime: {
              lt: timing.endTime,
            },
            timingEndTime: {
              gt: timing.startTime,
            },
          },
          select: {
            timingLabel: true,
            timingStartTime: true,
            timingEndTime: true,
          },
        });

        if (
          overlappingSession &&
          hasTimeOverlap(
            timing.startTime,
            timing.endTime,
            overlappingSession.timingStartTime,
            overlappingSession.timingEndTime
          )
        ) {
          throw new Error(
            `Session time overlaps with an existing session (${overlappingSession.timingLabel})`
          );
        }
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
              sessionDate,
              timingCode: timing.code,
              timingLabel: timing.label,
              timingStartTime: timing.startTime,
              timingEndTime: timing.endTime,
            },
            include: {
              Course: {
                select: {
                  code: true,
                  name: true,
                },
              },
              Section: {
                select: {
                  name: true,
                },
              },
            },
          }));

        const enrolledStudents = await tx.studentSection.findMany({
          where: {
            sectionId: payload.sectionId,
            semester: assignmentContext.semester,
            academicYear: assignmentContext.academicYear,
          },
          select: {
            studentId: true,
          },
        });

        if (enrolledStudents.length === 0) {
          throw new Error("No students found in the selected section");
        }

        const enrolledStudentIdSet = new Set(enrolledStudents.map((student) => student.studentId));
        const explicitStatuses = payload.studentStatuses ?? [];

        for (const item of explicitStatuses) {
          if (!enrolledStudentIdSet.has(item.studentId)) {
            throw new Error("One or more students do not belong to the selected section");
          }
        }

        const explicitStatusMap = new Map(
          explicitStatuses.map((item) => [item.studentId, item.status] as const)
        );

        const normalizedStatuses = enrolledStudents.map((student) => ({
          studentId: student.studentId,
          status:
            (explicitStatusMap.get(student.studentId) as AttendanceRecordStatusDTO | undefined) ??
            "PRESENT",
        }));

        await tx.attendanceRecord.createMany({
          data: normalizedStatuses.map((statusItem) => ({
            id: crypto.randomUUID(),
            sessionId: targetSession.id,
            studentId: statusItem.studentId,
            status: statusItem.status,
          })),
          skipDuplicates: true,
        });

        for (const [studentId, status] of explicitStatusMap.entries()) {
          await tx.attendanceRecord.upsert({
            where: {
              sessionId_studentId: {
                sessionId: targetSession.id,
                studentId,
              },
            },
            create: {
              id: crypto.randomUUID(),
              sessionId: targetSession.id,
              studentId,
              status,
            },
            update: {
              status,
              markedAt: new Date(),
            },
          });
        }

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

      if (operationResult.created) {
        return {
          status: "success",
          message: "Attendance session created successfully",
          data: {
            session: toSessionDto(operationResult.session),
            created: true,
            attendanceInitialization: operationResult.attendanceInitialization,
          },
        };
      }

      return {
        status: "success",
        message: "Attendance session opened successfully",
        data: {
          session: toSessionDto(operationResult.session),
          created: false,
          attendanceInitialization: operationResult.attendanceInitialization,
        },
      };
    } catch (error) {
      logger.error("Error creating or opening faculty attendance session", {
        error,
      });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to create attendance session");
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

      const where: Prisma.ClassSessionWhereInput = {
        facultyId,
      };

      if (query.courseId) {
        where.courseId = query.courseId;
      }

      if (query.sectionId) {
        where.sectionId = query.sectionId;
      }

      if (query.sessionDate) {
        const dayStart = new Date(`${query.sessionDate}T00:00:00.000Z`);
        const nextDayStart = new Date(`${query.sessionDate}T00:00:00.000Z`);
        nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);

        where.sessionDate = {
          gte: dayStart,
          lt: nextDayStart,
        };
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
            Course: {
              select: {
                code: true,
                name: true,
              },
            },
            Section: {
              select: {
                name: true,
              },
            },
          },
        });

        items = sessions.map(toSessionDto);
      } catch (includeError) {
        logger.error("Attendance sessions include resolution failed; retrying with scalar fallback", {
          includeError,
          includeErrorMessage:
            includeError instanceof Error ? includeError.message : "Unknown include error",
          facultyId,
          page,
          limit,
        });

        const scalarSessions = await db.classSession.findMany({
          where,
          orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            courseId: true,
            sectionId: true,
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
                where: {
                  id: {
                    in: uniqueCourseIds,
                  },
                },
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              })
            : Promise.resolve([]),
          uniqueSectionIds.length > 0
            ? db.section.findMany({
                where: {
                  id: {
                    in: uniqueSectionIds,
                  },
                },
                select: {
                  id: true,
                  name: true,
                },
              })
            : Promise.resolve([]),
        ]);

        const courseMap = new Map(courses.map((course) => [course.id, course]));
        const sectionMap = new Map(sections.map((section) => [section.id, section]));

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
      logger.error("Error retrieving faculty attendance sessions", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Failed to retrieve attendance sessions");
    }
  }
}
