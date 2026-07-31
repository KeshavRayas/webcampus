import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

export class AdminCondonationReportService {
  static async getCondonationReport(
    courseId: string,
    sectionId: string,
    batchId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        include: {
          semester: {
            include: {
              academicTerm: true,
            },
          },
        },
      });

      if (!course) {
        throw new Error("Course not found");
      }

      const studentSections = await db.studentSection.findMany({
        where: {
          sectionId,
          ...(batchId
            ? { student: { batches: { some: { id: batchId } } } }
            : {}),
        },
        include: {
          student: {
            include: { user: true, attendances: { where: { courseId } } },
          },
        },
      });

      const classSessions = await db.classSession.findMany({
        where: { courseId, sectionId, ...(batchId ? { batchId } : {}) },
        select: { id: true },
      });

      const attendanceRecords = await db.attendanceRecord.findMany({
        where: {
          sessionId: {
            in: classSessions.map((s) => s.id),
          },
        },
      });

      const mappedStudents = studentSections
        .map((ss) => {
          const studentRecords = attendanceRecords.filter(
            (r) => r.studentId === ss.studentId
          );
          const presentCount = studentRecords.filter(
            (r) => r.status === "PRESENT"
          ).length;
          const totalCount = studentRecords.filter(
            (r) => r.status !== null
          ).length;

          const attendanceAgg = ss.student.attendances[0];
          const percentageBefore =
            totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
          const percentageAfter = attendanceAgg?.percentage ?? percentageBefore;
          const condonedSessions =
            totalCount > 0
              ? Math.max(
                  0,
                  Math.round(
                    ((percentageAfter - percentageBefore) / 100) * totalCount
                  )
                )
              : 0;

          return {
            studentId: ss.studentId,
            usn: ss.student.usn,
            name: ss.student.user.name,
            presentSessions: presentCount,
            absentSessions: totalCount - presentCount,
            totalSessions: totalCount,
            condonedSessions,
            percentageBefore,
            percentageAfter,
            approvalStatus: attendanceAgg?.condonationStatus ?? "NOT_REQUESTED",
          };
        })
        .filter((student) => student.approvalStatus === "APPROVED");

      const result = {
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
        },
        semester: {
          id: course.semester.id,
          semesterNumber: course.semester.semesterNumber,
          academicTerm: {
            id: course.semester.academicTerm.id,
            type: course.semester.academicTerm.type,
            year: course.semester.academicTerm.year,
          },
        },
        students: mappedStudents,
      };

      return {
        status: "success",
        message: "Condonation report fetched",
        data: result,
      };
    } catch (error) {
      console.error(error);
      logger.error("Failed to get Admin condonation report", error);
      throw error;
    }
  }
}
