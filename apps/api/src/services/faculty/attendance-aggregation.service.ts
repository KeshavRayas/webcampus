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
   * Aggregates attendance records for a student-course pair.
   * Automatically discovers and processes both Theory (null) and Lab (batchId) records independently.
   * @param studentId UUID of the student
   * @param courseId UUID of the course
   * @param tx Prisma transaction client (optional, defaults to db)
   * @returns BaseResponse with the last processed aggregate data
   */
  static async aggregateAttendanceForStudentCourse(
    studentId: string,
    courseId: string,
    tx: DbLike = db
  ): Promise<BaseResponse<AttendanceAggregateResult>> {
    try {
      // 1. Discover all (batchId, electiveBatchId) pairs this student is part of
      const existingAggregates = await tx.attendance.findMany({
        where: { studentId, courseId },
        select: { batchId: true, electiveBatchId: true },
      });

      const activeRecords = await tx.attendanceRecord.findMany({
        where: { studentId, ClassSession: { courseId } },
        select: { batchId: true, electiveBatchId: true },
        distinct: ["batchId", "electiveBatchId"],
      });

      const pairKey = (
        batchId: string | null,
        electiveBatchId: string | null
      ) => `${batchId ?? ""}|${electiveBatchId ?? ""}`;

      const pairsToProcess = new Map<
        string,
        { batchId: string | null; electiveBatchId: string | null }
      >();

      const addPair = (
        batchId: string | null,
        electiveBatchId: string | null
      ) => {
        pairsToProcess.set(pairKey(batchId, electiveBatchId), {
          batchId,
          electiveBatchId,
        });
      };

      for (const a of existingAggregates) {
        addPair(a.batchId, a.electiveBatchId);
      }
      for (const r of activeRecords) {
        addPair(r.batchId, r.electiveBatchId);
      }

      // Fallback to processing Theory (null/null) if no records exist at all
      if (pairsToProcess.size === 0) {
        addPair(null, null);
      }

      let lastResult: AttendanceAggregateResult = {
        total: 0,
        present: 0,
        absent: 0,
        percentage: 0,
        condonationStatus: "NOT_REQUESTED",
      };

      // 2. Aggregate each (batchId, electiveBatchId) pair independently
      for (const { batchId, electiveBatchId } of pairsToProcess.values()) {
        const [total, present] = await Promise.all([
          tx.attendanceRecord.count({
            where: {
              studentId,
              batchId,
              electiveBatchId,
              ClassSession: { courseId },
            },
          }),
          tx.attendanceRecord.count({
            where: {
              studentId,
              batchId,
              electiveBatchId,
              status: "PRESENT",
              ClassSession: { courseId },
            },
          }),
        ]);

        const absent = total - present;
        const percentage = total > 0 ? (present / total) * 100 : 0;

        // If a session was deleted and the pair is now empty, clean up the aggregate row
        if (total === 0) {
          await tx.attendance.deleteMany({
            where: {
              studentId,
              courseId,
              batchId,
              electiveBatchId,
            },
          });
          continue;
        }

        // Using findFirst instead of upsert to safely bypass Prisma compound unique limits with null fields
        const existingAttendance = await tx.attendance.findFirst({
          where: {
            studentId,
            courseId,
            batchId,
            electiveBatchId,
          },
          select: {
            id: true,
            condonationStatus: true,
          },
        });

        const condonationStatus =
          existingAttendance?.condonationStatus ?? "NOT_REQUESTED";

        if (existingAttendance) {
          await tx.attendance.update({
            where: { id: existingAttendance.id },
            data: { total, present, absent, percentage },
          });
        } else {
          await tx.attendance.create({
            data: {
              id: crypto.randomUUID(),
              studentId,
              courseId,
              batchId,
              electiveBatchId,
              total,
              present,
              absent,
              percentage,
              condonationStatus,
            },
          });
        }

        lastResult = { total, present, absent, percentage, condonationStatus };
      }

      return {
        status: "success",
        message: "Attendance aggregated successfully",
        data: lastResult,
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
      // Find all unique students who have active records
      const recordsWithStudents = await tx.attendanceRecord.findMany({
        where: {
          ClassSession: { courseId },
        },
        select: { studentId: true },
        distinct: ["studentId"],
      });

      // Find all unique students who have existing aggregates (in case they need deletion)
      const aggregateStudents = await tx.attendance.findMany({
        where: { courseId },
        select: { studentId: true },
        distinct: ["studentId"],
      });

      const studentIds = Array.from(
        new Set([
          ...recordsWithStudents.map((r) => r.studentId),
          ...aggregateStudents.map((a) => a.studentId),
        ])
      );

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
