import {
  assertCanMutateAttendance,
  resolveFreezeState,
} from "@webcampus/api/src/services/faculty/freeze.service";
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
    data: CreateAttendanceType
  ): Promise<BaseResponse<AttendanceResponseType>> {
    try {
      const existingAttendance = await db.attendance.findUnique({
        where: {
          studentId_courseId: {
            studentId: data.studentId,
            courseId: data.courseId,
          },
        },
      });

      if (existingAttendance) {
        return {
          status: "error",
          message: "Attendance already exists for this student and course",
          error: "Attendance already exists for this student and course",
        };
      }

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
        data,
      });

      return {
        status: "success",
        message: "Attendance created successfully",
        data: attendance,
      };
    } catch (error) {
      logger.error("Error creating attendance:", { error });
      throw new Error("Failed to create attendance");
    }
  }

  static async getAll(): Promise<BaseResponse<AttendanceResponseType[]>> {
    try {
      const attendances = await db.attendance.findMany();

      return {
        status: "success",
        message: "Attendances retrieved successfully",
        data: attendances,
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
        data: attendance,
      };
    } catch (error) {
      logger.error("Error retrieving attendance:", { error });
      throw new Error("Failed to retrieve attendance");
    }
  }

  static async getByStudentAndCourse(
    studentId: string,
    courseId: string
  ): Promise<BaseResponse<AttendanceResponseType>> {
    try {
      const attendance = await db.attendance.findUnique({
        where: {
          studentId_courseId: {
            studentId,
            courseId,
          },
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
        data: attendance,
      };
    } catch (error) {
      logger.error("Error retrieving attendance:", { error });
      throw new Error("Failed to retrieve attendance");
    }
  }

  static async update(
    id: string,
    data: UpdateAttendanceType
  ): Promise<BaseResponse<AttendanceResponseType>> {
    try {
      const existingAttendance = await db.attendance.findUnique({
        where: { id },
        select: {
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
        data,
      });
      return {
        status: "success",
        message: "Attendance updated successfully",
        data: attendance,
      };
    } catch (error) {
      logger.error("Error updating attendance:", { error });
      throw new Error("Failed to update attendance");
    }
  }

  static async delete(id: string): Promise<BaseResponse<void>> {
    try {
      const existingAttendance = await db.attendance.findUnique({
        where: { id },
        select: {
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
      throw new Error("Failed to delete attendance");
    }
  }

  static async getDetailedReport(
    courseId: string,
    sectionId: string,
    batchId?: string
  ): Promise<BaseResponse<FacultyAttendanceDetailedReportDTO>> {
    try {
      const sessionWhere: {
        courseId: string;
        sectionId: string;
        batchId?: string;
      } = {
        courseId,
        sectionId,
      };
      if (batchId) {
        sessionWhere.batchId = batchId;
      }

      const sessions = await db.classSession.findMany({
        where: sessionWhere,
        orderBy: { sessionDate: "asc" },
        select: {
          id: true,
          sessionDate: true,
        },
      });

      const studentSections = await db.studentSection.findMany({
        where: { sectionId },
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

      if (!sessions.length || !studentSections.length) {
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
      const studentIds = studentSections.map((ss) => ss.student.id);

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

      const attendances = await db.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
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
        studentSections.map((ss) => {
          const studentId = ss.student.id;
          const recordMap = new Map<string, "PRESENT" | "ABSENT">();
          attendanceRecords
            .filter((r) => r.studentId === studentId)
            .forEach((r) => {
              recordMap.set(r.sessionId, r.status);
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
            usn: ss.student.usn,
            name: ss.student.user.name,
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
