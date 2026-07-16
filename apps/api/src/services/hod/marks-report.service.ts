import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

export class HODMarksReportService {
  private static async resolveHODDepartment(userId: string) {
    const hod = await db.hod.findUnique({
      where: { userId },
      select: {
        departmentName: true,
        department: { select: { id: true, type: true } },
      },
    });

    if (!hod?.department) {
      throw new Error("HOD profile not found or department not assigned");
    }

    return {
      departmentId: hod.department.id,
      departmentType: hod.department.type,
    };
  }

  static async getFilterOptions(
    userId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await this.resolveHODDepartment(userId);
      const terms = await db.academicTerm.findMany({
        orderBy: { year: "desc" },
      });
      const semesters = await db.semester.findMany({
        orderBy: { semesterNumber: "asc" },
      });

      return {
        status: "success",
        message: "Filter options fetched",
        data: {
          academicTerms: terms,
          semesters,
          departmentType: hod.departmentType,
        },
      };
    } catch (error) {
      console.error(error);
      logger.error("Failed to get HOD marks filter options", error);
      throw error;
    }
  }

  static async getCourses(
    userId: string,
    semesterId: string,
    cycle?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await this.resolveHODDepartment(userId);
      const courses = await db.course.findMany({
        where: {
          departmentId: hod.departmentId,
          semesterId,
          ...(cycle && hod.departmentType === "BASIC_SCIENCES"
            ? { cycle: cycle as Cycle }
            : {}),
        },
        select: { id: true, code: true, name: true },
      });
      return { status: "success", message: "Courses fetched", data: courses };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async getSections(
    userId: string,
    semesterId: string,
    courseId: string,
    cycle?: Cycle
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await this.resolveHODDepartment(userId);
      const sections = await db.section.findMany({
        where: {
          departmentId: hod.departmentId,
          semesterId,
          ...(cycle && hod.departmentType === "BASIC_SCIENCES"
            ? { cycle: cycle as Cycle }
            : {}),
          courses: { some: { id: courseId } },
        },
        select: { id: true, name: true },
      });
      return { status: "success", message: "Sections fetched", data: sections };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async getAssessments(
    courseId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const assessments = await db.assessmentTemplate.findMany({
        where: { courseId },
        select: { id: true, title: true, totalMarks: true },
        orderBy: { title: "asc" },
      });
      return {
        status: "success",
        message: "Assessments fetched",
        data: assessments,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async getMarksReport(
    sectionId: string,
    assessmentId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const studentSections = await db.studentSection.findMany({
        where: { sectionId },
        include: { student: { include: { user: true } } },
      });

      const marks = await db.studentAssessment.findMany({
        where: {
          assessmentId,
          studentId: { in: studentSections.map((s) => s.studentId) },
        },
      });

      const reportData = studentSections.map((ss) => {
        const markRecord = marks.find((m) => m.studentId === ss.studentId);
        return {
          studentId: ss.studentId,
          usn: ss.student.usn,
          name: ss.student.user.name,
          totalMarks: markRecord?.totalMarks ?? null,
          status: markRecord?.status ?? "NOT_ENTERED",
        };
      });

      // Sort by USN naturally
      reportData.sort((a, b) => a.usn.localeCompare(b.usn));

      return {
        status: "success",
        message: "Marks report fetched",
        data: reportData,
      };
    } catch (error) {
      console.error(error);
      logger.error("Failed to get marks report", error);
      throw error;
    }
  }
}
