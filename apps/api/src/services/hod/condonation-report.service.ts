import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";
import { resolveHODDepartment } from "./resolve-hod-department";

export class HODCondonationReportService {
  static async getCondonedReport(
    userId: string,
    filters: {
      semesterId: string;
      courseId: string;
      sectionId?: string;
      cycle?: string;
    }
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await resolveHODDepartment(userId);
      if (!hod) {
        throw new Error("HOD profile not found or department not assigned");
      }

      const course = await db.course.findFirst({
        where: {
          id: filters.courseId,
          departmentId: hod.departmentId,
          semesterId: filters.semesterId,
          ...(filters.cycle && hod.departmentType === "BASIC_SCIENCES"
            ? { cycle: filters.cycle as Cycle }
            : {}),
        },
        include: {
          semester: {
            include: {
              academicTerm: true,
            },
          },
        },
      });

      if (!course) {
        throw new Error("Course not found in your department");
      }

      const studentSections = await db.studentSection.findMany({
        where: {
          ...(filters.sectionId
            ? { sectionId: filters.sectionId }
            : { section: { courses: { some: { courseId: course.id } } } }),
        },
        include: {
          section: { select: { name: true } },
          student: {
            include: {
              user: true,
              attendances: { where: { courseId: course.id } },
            },
          },
        },
      });

      const classSessions = await db.classSession.findMany({
        where: {
          courseId: course.id,
          ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        },
        select: { id: true },
      });

      const attendanceRecords = await db.attendanceRecord.findMany({
        where: {
          sessionId: {
            in: classSessions.map((session) => session.id),
          },
        },
      });

      const mappedStudents = studentSections
        .map((studentSection) => {
          const studentRecords = attendanceRecords.filter(
            (record) => record.studentId === studentSection.studentId
          );
          const presentCount = studentRecords.filter(
            (record) => record.status === "PRESENT"
          ).length;
          const totalCount = studentRecords.filter(
            (record) => record.status !== null
          ).length;

          const attendanceAgg = studentSection.student.attendances[0];
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
            usn: studentSection.student.usn,
            name: studentSection.student.user.name,
            section: studentSection.section.name,
            presentSessions: presentCount,
            absentSessions: totalCount - presentCount,
            totalSessions: totalCount,
            condonedSessions,
            percentageBefore,
            percentageAfter,
            approvalStatus: attendanceAgg?.condonationStatus ?? "NOT_REQUESTED",
          };
        })
        .filter((student) => student.approvalStatus === "APPROVED")
        .sort((a, b) => a.usn.localeCompare(b.usn));

      return {
        status: "success",
        message: "Condoned students report fetched",
        data: {
          course: {
            code: course.code,
            name: course.name,
          },
          semester: {
            semesterNumber: course.semester.semesterNumber,
            academicTerm: {
              year: course.semester.academicTerm.year,
              type: course.semester.academicTerm.type,
            },
          },
          students: mappedStudents,
        },
      };
    } catch (error) {
      logger.error(
        "Error in HODCondonationReportService.getCondonedReport",
        error
      );
      throw error;
    }
  }
}
