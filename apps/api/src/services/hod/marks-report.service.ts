import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";
import { resolveHODDepartment } from "./resolve-hod-department";

export class HODMarksReportService {
  private static async requireHODDepartment(userId: string) {
    const hod = await resolveHODDepartment(userId);
    if (!hod) {
      throw new Error("HOD profile not found or department not assigned");
    }
    return hod;
  }

  private static async verifyCourseOwnership(userId: string, courseId: string) {
    const hod = await this.requireHODDepartment(userId);
    const course = await db.course.findFirst({
      where: { id: courseId, departmentId: hod.departmentId },
      select: { id: true },
    });
    if (!course) {
      throw new Error("Course not found in your department");
    }
    return hod;
  }

  private static async verifySectionOwnership(
    userId: string,
    sectionId: string,
    courseId: string
  ) {
    const hod = await this.requireHODDepartment(userId);
    const section = await db.section.findFirst({
      where: {
        id: sectionId,
        departmentId: hod.departmentId,
        courses: { some: { courseId } },
      },
      select: { id: true },
    });
    if (!section) {
      throw new Error("Section not found in your department");
    }
    return hod;
  }

  static async getFilterOptions(
    userId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await this.requireHODDepartment(userId);
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
      logger.error("Failed to get HOD marks filter options", error);
      throw error;
    }
  }

  static async getCourses(
    userId: string,
    semesterId: string,
    cycle?: string
  ): Promise<BaseResponse<unknown>> {
    const hod = await this.requireHODDepartment(userId);
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
  }

  static async getSections(
    userId: string,
    semesterId: string,
    courseId: string,
    cycle?: Cycle
  ): Promise<BaseResponse<unknown>> {
    await this.verifyCourseOwnership(userId, courseId);
    const hod = await this.requireHODDepartment(userId);
    const sections = await db.section.findMany({
      where: {
        departmentId: hod.departmentId,
        semesterId,
        ...(cycle && hod.departmentType === "BASIC_SCIENCES"
          ? { cycle: cycle as Cycle }
          : {}),
        courses: { some: { courseId } },
      },
      select: { id: true, name: true },
    });
    return { status: "success", message: "Sections fetched", data: sections };
  }

  static async getAssessments(
    userId: string,
    courseId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      await this.verifyCourseOwnership(userId, courseId);
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
      logger.error("Failed to get HOD marks assessments", error);
      throw error;
    }
  }

  static async getMarksReport(
    userId: string,
    courseId: string,
    sectionId: string,
    assessmentId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      await this.verifyCourseOwnership(userId, courseId);
      await this.verifySectionOwnership(userId, sectionId, courseId);

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
        throw new Error("Course not found in your department");
      }

      const assessments = await db.assessmentTemplate.findMany({
        where: {
          courseId,
          ...(assessmentId ? { id: assessmentId } : {}),
        },
        orderBy: { title: "asc" },
      });

      if (assessmentId && assessments.length === 0) {
        throw new Error("Assessment not found for this course");
      }

      const registrations = await db.courseRegistration.findMany({
        where: {
          courseId,
          semesterId: course.semesterId,
          student: {
            studentSections: {
              some: { sectionId },
            },
          },
        },
        include: {
          student: {
            select: {
              id: true,
              usn: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
      });

      const studentIds = registrations.map(
        (registration) => registration.student.id
      );
      const assessmentIds = assessments.map((assessment) => assessment.id);

      const studentAssessments = await db.studentAssessment.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
          assessmentId: { in: assessmentIds },
        },
      });

      const marksMap = new Map<
        string,
        { cieTotal: number | null; status: string }
      >(
        studentIds.map((id) => [id, { cieTotal: null, status: "NOT_ELIGIBLE" }])
      );

      const markRecords = await db.mark.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
        },
      });

      for (const mark of markRecords) {
        marksMap.set(mark.studentId, {
          cieTotal: mark.cieTotal,
          status: mark.status,
        });
      }

      const assessmentMap = new Map(
        studentAssessments.map((studentAssessment) => [
          `${studentAssessment.studentId}_${studentAssessment.assessmentId}`,
          studentAssessment,
        ])
      );

      const students = registrations.map((registration) => {
        const markInfo = marksMap.get(registration.student.id) ?? {
          cieTotal: null,
          status: "NOT_ELIGIBLE",
        };

        const assessmentScores = assessments.map((assessment) => {
          const studentAssessment = assessmentMap.get(
            `${registration.student.id}_${assessment.id}`
          );
          return {
            assessmentId: assessment.id,
            assessmentTitle: assessment.title,
            totalMarks: studentAssessment?.totalMarks ?? null,
            maxMarks: assessment.totalMarks,
          };
        });

        return {
          usn: registration.student.usn,
          name: registration.student.user.name,
          assessments: assessmentScores,
          cieTotal: markInfo.cieTotal,
          status: markInfo.status,
        };
      });

      students.sort((a, b) => a.usn.localeCompare(b.usn));

      return {
        status: "success",
        message: "Marks report fetched",
        data: {
          course: {
            id: course.id,
            code: course.code,
            name: course.name,
            cumulativeMinMarks:
              (course.cieEligibility / 100) * course.cieMaxMarks,
            cieEligibilityPercent: course.cieEligibility,
          },
          assessments: assessments.map((assessment) => ({
            id: assessment.id,
            title: assessment.title,
            totalMarks: assessment.totalMarks,
          })),
          semester: {
            id: course.semester.id,
            semesterNumber: course.semester.semesterNumber,
            academicTerm: {
              id: course.semester.academicTerm.id,
              type: course.semester.academicTerm.type,
              year: course.semester.academicTerm.year,
            },
          },
          students,
        },
      };
    } catch (error) {
      logger.error("Failed to get HOD marks report", error);
      throw error;
    }
  }
}
