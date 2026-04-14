import { logger } from "@webcampus/common/logger";
import { db, type Prisma } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

type DbLike = Prisma.TransactionClient | typeof db;

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
    tx: DbLike = db
  ): Promise<BaseResponse<AttendanceAggregateResult>> {
    try {
      const [total, present] = await Promise.all([
        tx.attendanceRecord.count({
          where: {
            studentId,
            ClassSession: {
              courseId,
            },
          },
        }),
        tx.attendanceRecord.count({
          where: {
            studentId,
            status: "PRESENT",
            ClassSession: {
              courseId,
            },
          },
        }),
      ]);

      const absent = total - present;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      if (total === 0) {
        await tx.attendance.deleteMany({
          where: {
            studentId,
            courseId,
          },
        });

        return {
          status: "success",
          message: "Attendance aggregate removed because no records remain",
          data: {
            total: 0,
            present: 0,
            absent: 0,
            percentage: 0,
            condonationStatus: "NOT_REQUESTED",
          },
        };
      }

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

      const condonationStatus =
        existingAttendance?.condonationStatus ?? "NOT_REQUESTED";

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
      logger.error("Error aggregating attendance:", {
        error,
        studentId,
        courseId,
      });
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
    tx: DbLike = db
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
      logger.error("Error aggregating attendance for course:", {
        error,
        courseId,
      });
      throw new Error("Failed to aggregate attendance for course");
    }
  }
}
