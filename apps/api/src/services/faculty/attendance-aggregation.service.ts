import { logger } from "@webcampus/common/logger";
import { db, type Prisma } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

export interface AttendanceAggregateResult {
  total: number;
  present: number;
  absent: number;
  percentage: number;
  condonationStatus: string;
}

export class AttendanceAggregationService {
  /**
   * Aggregates attendance records for a student-course pair and upserts the Attendance record
   * @param studentId UUID of the student
   * @param courseId UUID of the course
   * @param tx Prisma transaction client (optional, defaults to db)
   * @returns BaseResponse with aggregated attendance data
   */
  static async aggregateAttendanceForStudentCourse(
    studentId: string,
    courseId: string,
    tx: typeof db = db
  ): Promise<BaseResponse<AttendanceAggregateResult>> {
    try {
      // Step 1: Find all ClassSessions for this course
      const sessions = await tx.classSession.findMany({
        where: {
          courseId,
        },
        select: {
          id: true,
        },
      });

      const sessionIds = sessions.map((s) => s.id);

      // Step 2: Count attendance records for this student in this course
      const attendanceRecords = await tx.attendanceRecord.findMany({
        where: {
          studentId,
          sessionId: {
            in: sessionIds,
          },
        },
        select: {
          status: true,
        },
      });

      // Step 3: Calculate totals
      const total = attendanceRecords.length;
      const present = attendanceRecords.filter((r) => r.status === "PRESENT").length;
      const absent = total - present;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      // Step 4: Get existing condonation status if attendance exists
      const existingAttendance = await tx.attendance.findUnique({
        where: {
          studentId_courseId: {
            studentId,
            courseId,
          },
        },
        select: {
          condonationStatus: true,
        },
      });

      const condonationStatus = existingAttendance?.condonationStatus ?? "NOT_REQUESTED";

      // Step 5: Upsert the Attendance record
      await tx.attendance.upsert({
        where: {
          studentId_courseId: {
            studentId,
            courseId,
          },
        },
        create: {
          id: crypto.randomUUID(),
          studentId,
          courseId,
          total,
          present,
          absent,
          percentage,
          condonationStatus,
        },
        update: {
          total,
          present,
          absent,
          percentage,
        },
      });

      return {
        status: "success",
        message: "Attendance aggregated successfully",
        data: {
          total,
          present,
          absent,
          percentage,
          condonationStatus,
        },
      };
    } catch (error) {
      logger.error("Error aggregating attendance:", { error, studentId, courseId });
      throw new Error("Failed to aggregate attendance");
    }
  }

  /**
   * Aggregates attendance for all students in a course (batch operation)
   * @param courseId UUID of the course
   * @param tx Prisma transaction client (optional, defaults to db)
   */
  static async aggregateAttendanceForCourse(
    courseId: string,
    tx: typeof db = db
  ): Promise<BaseResponse<{ processedCount: number }>> {
    try {
      // Find all unique students who have attendance records for this course
      const recordsWithStudents = await tx.attendanceRecord.findMany({
        where: {
          ClassSession: {
            courseId,
          },
        },
        select: {
          studentId: true,
        },
        distinct: ["studentId"],
      });

      const studentIds = recordsWithStudents.map((r) => r.studentId);

      // Aggregate for each student
      for (const studentId of studentIds) {
        await this.aggregateAttendanceForStudentCourse(studentId, courseId, tx);
      }

      return {
        status: "success",
        message: `Attendance aggregated for ${studentIds.length} students`,
        data: {
          processedCount: studentIds.length,
        },
      };
    } catch (error) {
      logger.error("Error aggregating attendance for course:", { error, courseId });
      throw new Error("Failed to aggregate attendance for course");
    }
  }
}
