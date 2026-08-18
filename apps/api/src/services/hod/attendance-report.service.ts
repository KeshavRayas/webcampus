import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";
import { assertBatchBelongsToCourse } from "../shared/batch-managed";
import { FACULTY_COURSE_STATUS } from "../shared/course-approval";
import { isBatchManagedCourse } from "../shared/course-kind";

export class HODAttendanceReportService {
  private static async resolveHODDepartment(userId: string) {
    const hod = await db.hod.findUnique({
      where: { userId },
      select: {
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
  // 1. Get Filter Options (Terms & Semesters)
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
      logger.error("Failed to get HOD filter options", error);
      throw error;
    }
  }

  // 2. Get Courses (Filtered by HOD Dept & Cycle)
  static async getCourses(
    userId: string,
    semesterId: string,
    cycle?: string
  ): Promise<BaseResponse<unknown>> {
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
  }

  // 3. Get Sections
  static async getSections(
    userId: string,
    semesterId: string,
    courseId: string,
    cycle?: string
  ): Promise<BaseResponse<unknown>> {
    const hod = await this.resolveHODDepartment(userId);
    const course = await db.course.findFirst({
      where: { id: courseId, departmentId: hod.departmentId },
      select: { courseType: true },
    });
    if (!course) throw new Error("Course not found in your department");

    if (isBatchManagedCourse(course.courseType)) {
      const electiveAssignments = await db.electiveBatchFaculty.findMany({
        where: {
          courseId,
          course: {
            approvalStatus: FACULTY_COURSE_STATUS,
            semesterId,
            departmentId: hod.departmentId,
          },
        },
        select: { electiveBatch: { select: { id: true, name: true } } },
        orderBy: { electiveBatch: { name: "asc" } },
      });
      const seen = new Set<string>();
      const sections: { id: string; name: string; isElectiveBatch: boolean }[] =
        [];
      for (const assignment of electiveAssignments) {
        if (!seen.has(assignment.electiveBatch.id)) {
          seen.add(assignment.electiveBatch.id);
          sections.push({
            id: assignment.electiveBatch.id,
            name: assignment.electiveBatch.name,
            isElectiveBatch: true,
          });
        }
      }
      return {
        status: "success",
        message: "Sections fetched",
        data: sections,
      };
    }

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

  // 4. Get Detailed Report (Matches Faculty Output EXACTLY)
  static async getDetailedReport(
    userId: string,
    courseId: string,
    sectionId: string,
    batchId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await this.resolveHODDepartment(userId);

      // Verify ownership
      const course = await db.course.findFirst({
        where: { id: courseId, departmentId: hod.departmentId },
      });
      if (!course) throw new Error("Course not found in your department");

      const isBatchManaged = isBatchManagedCourse(course.courseType);
      if (isBatchManaged) {
        await assertBatchBelongsToCourse(courseId, sectionId);
      }

      // Fetch Students
      // FIX 1: Filter batchId through the student relation, as StudentSection lacks a batchId field
      const studentSections = isBatchManaged
        ? await db.electiveStudentAssignment.findMany({
            where: { courseId, electiveBatchId: sectionId },
            include: { student: { include: { user: true } } },
          })
        : await db.studentSection.findMany({
            where: {
              sectionId,
              ...(batchId
                ? { student: { batches: { some: { id: batchId } } } }
                : {}),
            },
            include: { student: { include: { user: true } } },
          });

      // Fetch Sessions
      // FIX 2: Use db.classSession instead of db.attendanceSession
      const sessions = isBatchManaged
        ? await db.classSession.findMany({
            where: { courseId, electiveBatchId: sectionId },
            orderBy: { sessionDate: "asc" },
          })
        : await db.classSession.findMany({
            where: { courseId, sectionId, ...(batchId ? { batchId } : {}) },
            orderBy: { sessionDate: "asc" },
          });

      // Fetch Attendance Records
      const attendanceRecords = await db.attendanceRecord.findMany({
        where: { sessionId: { in: sessions.map((s) => s.id) } },
      });

      // Map to exact Faculty format
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

        return {
          studentId: ss.studentId,
          usn: ss.student.usn,
          name: ss.student.user.name,
          presentCount,
          absentCount: totalCount - presentCount,
          totalCount,
          percentage:
            totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0,
          attendanceBySession: sessions.map((session) => ({
            sessionId: session.id,
            status:
              studentRecords.find((r) => r.sessionId === session.id)?.status ||
              null,
          })),
        };
      });

      return {
        status: "success",
        message: "Detailed report fetched",
        data: {
          sessions: sessions.map((s) => ({
            id: s.id,
            sessionDate: s.sessionDate,
            // Changed back to timingMode to match your generated Prisma client
            timingMode: s.timingCode,
          })),
          students: mappedStudents,
        },
      };
    } catch (error) {
      console.error(error);
      logger.error("Failed to get HOD detailed report", error);
      throw error;
    }
  }
}
