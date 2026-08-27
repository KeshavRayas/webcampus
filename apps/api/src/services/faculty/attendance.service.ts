/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  assertCanMutateAttendance,
  resolveFreezeState,
} from "@webcampus/api/src/services/faculty/freeze.service";
import { buildRegistrationWhere } from "@webcampus/api/src/services/shared/registration-helper.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  AttendanceResponseType,
  CreateAttendanceType,
  UpdateAttendanceType,
} from "@webcampus/schemas/faculty";
import {
  BaseResponse,
  FacultyAttendanceDetailedReportDTO,
} from "@webcampus/types/api";

export class Attendance {
  static async create(
    data: CreateAttendanceType & { batchId?: string | null }
  ): Promise<BaseResponse<AttendanceResponseType>> {
    try {
      // Swapped findUnique to findFirst to avoid outdated compound key TS errors
      const existingAttendance = await db.attendance.findFirst({
        where: {
          studentId: data.studentId,
          courseId: data.courseId,
          batchId: data.batchId ?? null,
        },
      });

      if (existingAttendance) {
        return {
          status: "error",
          message:
            "Attendance already exists for this student, course, and batch",
          error: "Attendance already exists",
        };
      }

      const { PeCapacityService } = await import(
        "@webcampus/api/src/services/shared/pe-capacity.service"
      );
      await PeCapacityService.assertPeDownstreamReady(data.courseId);

      const freezeCourse = await db.course.findUnique({
        where: { id: data.courseId },
        select: {
          assignments: {
            select: { freezes: true },
            take: 1,
          },
        },
      });
      const freezeAssignment = freezeCourse?.assignments?.[0];
      if (freezeAssignment) {
        assertCanMutateAttendance(
          "faculty",
          resolveFreezeState(freezeAssignment.freezes)
        );
      }

      const attendance = await db.attendance.create({
        data: {
          ...data,
          batchId: data.batchId ?? null,
        } as any,
      });

      return {
        status: "success",
        message: "Attendance created successfully",
        data: attendance as any,
      };
    } catch (error) {
      logger.error("Error creating attendance:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to create attendance");
    }
  }

  static async getAll(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    role?: string;
  }): Promise<BaseResponse<AttendanceResponseType[]>> {
    try {
      const page = Math.max(1, params?.page ?? 1);
      const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
      const skip = (page - 1) * limit;
      // Admin sees all with pagination; faculty scoped to assigned courses
      if (params?.role === "admin") {
        const attendances = await db.attendance.findMany({
          skip,
          take: limit,
          orderBy: { id: "asc" },
        });
        return {
          status: "success",
          message: "Attendances retrieved successfully",
          data: attendances as any,
        };
      }
      if (params?.userId) {
        const faculty = await db.faculty.findUnique({
          where: { userId: params.userId },
          select: { id: true },
        });
        if (faculty) {
          const assignments = await db.courseAssignment.findMany({
            where: { facultyId: faculty.id },
            select: { courseId: true },
          });
          const elective = await db.electiveBatchFaculty.findMany({
            where: { facultyId: faculty.id },
            select: { courseId: true },
          });
          const courseIds = [
            ...new Set([
              ...assignments.map((a) => a.courseId),
              ...elective.map((e) => e.courseId),
            ]),
          ];
          if (courseIds.length === 0)
            return {
              status: "success",
              message: "Attendances retrieved successfully",
              data: [] as any,
            };
          const attendances = await db.attendance.findMany({
            where: { courseId: { in: courseIds } },
            skip,
            take: limit,
            orderBy: { id: "asc" },
          });
          return {
            status: "success",
            message: "Attendances retrieved successfully",
            data: attendances as any,
          };
        }
      }
      const attendances = await db.attendance.findMany({
        skip,
        take: limit,
        orderBy: { id: "asc" },
      });
      return {
        status: "success",
        message: "Attendances retrieved successfully",
        data: attendances as any,
      };
    } catch (error) {
      logger.error("Error retrieving attendances:", { error });
      throw new Error("Failed to retrieve attendances");
    }
  }

  static async getById(
    id: string
  ): Promise<BaseResponse<AttendanceResponseType>> {
    try {
      const attendance = await db.attendance.findUnique({
        where: { id },
      });

      if (!attendance) {
        return {
          status: "error",
          message: "Attendance not found",
          error: "Attendance not found",
        };
      }

      return {
        status: "success",
        message: "Attendance retrieved successfully",
        data: attendance as any,
      };
    } catch (error) {
      logger.error("Error retrieving attendance:", { error });
      throw new Error("Failed to retrieve attendance");
    }
  }

  static async getByStudentAndCourse(
    studentId: string,
    courseId: string,
    batchId?: string | null,
    userId?: string
  ): Promise<BaseResponse<AttendanceResponseType>> {
    try {
      if (userId) {
        const faculty = await db.faculty.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (faculty) {
          const assigned = await db.courseAssignment.findFirst({
            where: { courseId, facultyId: faculty.id },
          });
          const batchAssigned = await db.electiveBatchFaculty.findFirst({
            where: { courseId, facultyId: faculty.id },
          });
          if (!assigned && !batchAssigned)
            throw new Error("Unauthorized to view attendance for this course");
        }
      }
      // Swapped findUnique to findFirst to handle new batchId requirement safely
      const attendance = await db.attendance.findFirst({
        where: {
          studentId,
          courseId,
          batchId: batchId ?? null,
        },
      });

      if (!attendance) {
        return {
          status: "error",
          message: "Attendance not found",
          error: "Attendance not found",
        };
      }

      return {
        status: "success",
        message: "Attendance retrieved successfully",
        data: attendance as any,
      };
    } catch (error) {
      logger.error("Error retrieving attendance:", { error });
      throw new Error("Failed to retrieve attendance");
    }
  }

  static async update(
    id: string,
    data: UpdateAttendanceType & { batchId?: string | null }
  ): Promise<BaseResponse<AttendanceResponseType>> {
    try {
      const existingAttendance = await db.attendance.findUnique({
        where: { id },
        select: {
          courseId: true,
          course: {
            select: {
              assignments: {
                select: {
                  freezes: true,
                },
              },
            },
          },
        },
      });

      if (!existingAttendance) {
        return {
          status: "error",
          message: "Attendance not found",
          error: "Attendance not found",
        };
      }

      const { PeCapacityService } = await import(
        "@webcampus/api/src/services/shared/pe-capacity.service"
      );
      await PeCapacityService.assertPeDownstreamReady(
        existingAttendance.courseId
      );

      const courseAssignment = existingAttendance.course.assignments[0];
      if (courseAssignment?.freezes) {
        try {
          assertCanMutateAttendance(
            "faculty",
            resolveFreezeState(courseAssignment.freezes)
          );
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Cannot update attendance";
          return { status: "error", message: msg, error: msg };
        }
      }

      const attendance = await db.attendance.update({
        where: { id },
        data: data as any,
      });
      return {
        status: "success",
        message: "Attendance updated successfully",
        data: attendance as any,
      };
    } catch (error) {
      logger.error("Error updating attendance:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to update attendance");
    }
  }

  static async delete(id: string): Promise<BaseResponse<void>> {
    try {
      const existingAttendance = await db.attendance.findUnique({
        where: { id },
        select: {
          courseId: true,
          course: {
            select: {
              assignments: {
                select: {
                  freezes: true,
                },
              },
            },
          },
        },
      });
      if (!existingAttendance) {
        return {
          status: "error",
          message: "Attendance not found",
          error: "Attendance not found",
        };
      }
      const { PeCapacityService } = await import(
        "@webcampus/api/src/services/shared/pe-capacity.service"
      );
      await PeCapacityService.assertPeDownstreamReady(
        existingAttendance.courseId
      );

      const courseAssignment = existingAttendance.course.assignments[0];
      if (courseAssignment?.freezes) {
        try {
          assertCanMutateAttendance(
            "faculty",
            resolveFreezeState(courseAssignment.freezes)
          );
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Cannot delete attendance";
          return { status: "error", message: msg, error: msg };
        }
      }
      await db.attendance.delete({
        where: { id },
      });
      return {
        status: "success",
        message: "Attendance deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Error deleting attendance:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to delete attendance");
    }
  }

  static async getDetailedReport(
    courseId: string,
    sectionId?: string,
    batchId?: string,
    electiveBatchId?: string
  ): Promise<BaseResponse<FacultyAttendanceDetailedReportDTO>> {
    try {
      const sessionWhere: {
        courseId: string;
        sectionId?: string;
        batchId?: string;
        electiveBatchId?: string;
      } = {
        courseId,
        ...(sectionId ? { sectionId } : {}),
      };
      if (batchId) {
        sessionWhere.batchId = batchId;
      }
      if (electiveBatchId) {
        sessionWhere.electiveBatchId = electiveBatchId;
      }

      const sessions = await db.classSession.findMany({
        where: sessionWhere,
        orderBy: { sessionDate: "asc" },
        select: {
          id: true,
          sessionDate: true,
        },
      });

      const course = await db.course.findUnique({
        where: { id: courseId },
        select: {
          semesterId: true,
          semester: { select: { academicTermId: true } },
        },
      });
      if (!course) throw new Error("Course not found");

      let registrations: Array<{
        student: {
          id: string;
          usn: string;
          user: { name: string };
        };
      }> = [];
      if (electiveBatchId) {
        const assignments = await db.electiveStudentAssignment.findMany({
          where: { courseId, electiveBatchId },
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
        registrations = assignments.map((a) => ({ student: a.student }));
      } else {
        registrations = await db.courseRegistration.findMany({
          where: buildRegistrationWhere({
            courseId,
            semesterId: course.semesterId,
            academicTermId: course.semester.academicTermId,
            sectionId: sectionId ?? "",
            batchId: batchId ?? undefined,
          }),
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
      }

      if (!sessions.length || !registrations.length) {
        return {
          status: "success",
          message: "Detailed report retrieved successfully",
          data: {
            sessions: sessions.map((s) => ({
              id: s.id,
              sessionDate: s.sessionDate.toISOString(),
            })),
            students: [],
          },
        };
      }

      const sessionIds = sessions.map((s) => s.id);
      const studentIds = registrations.map((r) => r.student.id);

      const attendanceRecords = await db.attendanceRecord.findMany({
        where: {
          sessionId: { in: sessionIds },
          studentId: { in: studentIds },
        },
        select: {
          sessionId: true,
          studentId: true,
          status: true,
        },
      });

      // Added batchId filter so Theory and Lab condonation statuses don't mix
      const attendances = await db.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
          batchId: batchId ?? null,
        },
        select: {
          studentId: true,
          condonationStatus: true,
        },
      });

      const attendanceMap = new Map(
        attendances.map((a) => [a.studentId, a.condonationStatus])
      );

      const students: FacultyAttendanceDetailedReportDTO["students"] =
        registrations.map((r) => {
          const studentId = r.student.id;
          const recordMap = new Map<string, "PRESENT" | "ABSENT">();
          attendanceRecords
            .filter((ar) => ar.studentId === studentId)
            .forEach((ar) => {
              recordMap.set(ar.sessionId, ar.status);
            });

          const sessionStatuses = sessions.map((s) => {
            const status = recordMap.get(s.id);
            return status || "ABSENT";
          });

          const presentSessions = sessionStatuses.filter(
            (s) => s === "PRESENT"
          ).length;
          const absentSessions = sessionStatuses.filter(
            (s) => s === "ABSENT"
          ).length;
          const totalSessions = sessions.length;
          const percentage =
            totalSessions > 0
              ? Math.round((presentSessions / totalSessions) * 100 * 100) / 100
              : 0;
          const condonationStatus =
            attendanceMap.get(studentId) || "NOT_REQUESTED";

          let status: "Eligible" | "Not Eligible";
          if (percentage >= 85) {
            status = "Eligible";
          } else if (percentage >= 75 && condonationStatus === "APPROVED") {
            status = "Eligible";
          } else {
            status = "Not Eligible";
          }

          return {
            studentId,
            usn: r.student.usn,
            name: r.student.user.name,
            sessionStatuses,
            condonationStatus,
            totalSessions,
            presentSessions,
            absentSessions,
            percentage,
            status,
          };
        });

      return {
        status: "success",
        message: "Detailed report retrieved successfully",
        data: {
          sessions: sessions.map((s) => ({
            id: s.id,
            sessionDate: s.sessionDate.toISOString(),
          })),
          students,
        },
      };
    } catch (error) {
      logger.error("Error retrieving detailed report:", { error });
      throw new Error("Failed to retrieve detailed report");
    }
  }
}
