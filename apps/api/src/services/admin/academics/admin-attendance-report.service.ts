import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

export class AdminAttendanceReportService {
  // 1. Get Courses (Filtered by Department & Cycle)
  static async getCourses(
    departmentId: string,
    semesterId: string,
    cycle?: string
  ): Promise<BaseResponse<unknown>> {
    const department = await db.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) throw new Error("Department not found");

    const courses = await db.course.findMany({
      where: {
        departmentId,
        semesterId,
        ...(cycle && department.type === "BASIC_SCIENCES"
          ? { cycle: cycle as Cycle }
          : {}),
      },
      select: { id: true, code: true, name: true },
    });

    return { status: "success", message: "Courses fetched", data: courses };
  }

  // 2. Get Sections
  static async getSections(
    departmentId: string,
    semesterId: string,
    courseId: string,
    cycle?: string
  ): Promise<BaseResponse<unknown>> {
    const department = await db.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) throw new Error("Department not found");

    const sections = await db.section.findMany({
      where: {
        departmentId,
        semesterId,
        ...(cycle && department.type === "BASIC_SCIENCES"
          ? { cycle: cycle as Cycle }
          : {}),
        courses: { some: { id: courseId } },
      },
      select: { id: true, name: true },
    });

    return { status: "success", message: "Sections fetched", data: sections };
  }

  // 3. Get Status Report (Session wise aggregation)
  static async getStatusReport(
    courseId: string,
    sectionId: string,
    batchId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const sessions = await db.classSession.findMany({
        where: { courseId, sectionId, ...(batchId ? { batchId } : {}) },
        orderBy: { sessionDate: "asc" },
      });

      const attendanceRecords = await db.attendanceRecord.findMany({
        where: { sessionId: { in: sessions.map((s) => s.id) } },
      });

      const studentSections = await db.studentSection.findMany({
        where: {
          sectionId,
          ...(batchId
            ? { student: { batches: { some: { id: batchId } } } }
            : {}),
        },
        select: { studentId: true },
      });
      const totalStudents = studentSections.length;

      const data = sessions.map((session) => {
        const records = attendanceRecords.filter(
          (r) => r.sessionId === session.id
        );
        const presentCount = records.filter(
          (r) => r.status === "PRESENT"
        ).length;
        const absentCount = totalStudents - presentCount;
        return {
          id: session.id,
          sessionDate: session.sessionDate,
          totalStudents,
          presentCount,
          absentCount,
          percentage:
            totalStudents > 0
              ? Math.round((presentCount / totalStudents) * 100)
              : 0,
        };
      });

      return {
        status: "success",
        message: "Status report fetched",
        data,
      };
    } catch (error) {
      logger.error("Failed to get Admin status report", error);
      throw error;
    }
  }

  // 4. Get Detailed Report
  static async getDetailedReport(
    courseId: string,
    sectionId: string,
    batchId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
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

      const sessions = await db.classSession.findMany({
        where: { courseId, sectionId, ...(batchId ? { batchId } : {}) },
        orderBy: { sessionDate: "asc" },
      });

      const attendanceRecords = await db.attendanceRecord.findMany({
        where: { sessionId: { in: sessions.map((s) => s.id) } },
      });

      const mappedStudents = studentSections.map((ss) => {
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

        return {
          studentId: ss.studentId,
          usn: ss.student.usn,
          name: ss.student.user.name,
          presentSessions: presentCount,
          absentSessions: totalCount - presentCount,
          totalSessions: totalCount,
          percentage:
            attendanceAgg?.percentage ??
            (totalCount > 0
              ? Math.round((presentCount / totalCount) * 100)
              : 0),
          condonationStatus:
            attendanceAgg?.condonationStatus ?? "NOT_REQUESTED",
          sessionStatuses: sessions.map((session) => {
            const rec = studentRecords.find((r) => r.sessionId === session.id);
            return rec?.status || null;
          }),
        };
      });

      return {
        status: "success",
        message: "Detailed report fetched",
        data: {
          sessions: sessions.map((s) => ({
            id: s.id,
            sessionDate: s.sessionDate,
            timingMode: s.timingCode,
          })),
          students: mappedStudents,
        },
      };
    } catch (error) {
      console.error(error);
      logger.error("Failed to get Admin detailed report", error);
      throw error;
    }
  }
}
