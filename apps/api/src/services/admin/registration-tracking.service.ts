import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { GetRegistrationTrackingQueryType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

export interface RegistrationTrackingStudentItem {
  studentId: string;
  studentName: string;
  usn: string;
  isRegistered: boolean;
  registrationDate: string | null;
  registeredCourseCount: number;
}

export interface StudentRegisteredCourseItem {
  id: string;
  code: string;
  name: string;
  courseType: string;
  ltp: string;
  totalCredits: number;
}

export class RegistrationTrackingService {
  /**
   * Determine whether the semester targets first-year UG (cycle-scoped)
   * or a higher semester (department-scoped).
   */
  private static async resolveSemesterScope(semesterId: string): Promise<{
    isFirstYearUG: boolean;
    semesterNumber: number;
    programType: "UG" | "PG";
  }> {
    const semester = await db.semester.findUnique({
      where: { id: semesterId },
      select: { semesterNumber: true, programType: true },
    });

    if (!semester) {
      throw new Error("Semester not found");
    }

    return {
      isFirstYearUG:
        semester.programType === "UG" &&
        FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber),
      semesterNumber: semester.semesterNumber,
      programType: semester.programType,
    };
  }

  /**
   * Retrieve student registration statuses for a specific academic instance.
   */
  static async getStudentRegistrationStatus(
    query: GetRegistrationTrackingQueryType
  ): Promise<BaseResponse<RegistrationTrackingStudentItem[]>> {
    try {
      const scope = await this.resolveSemesterScope(query.semesterId);

      const students = await db.student.findMany({
        where: {
          semesterId: query.semesterId,
          academicTermId: query.academicTermId,
          ...(scope.isFirstYearUG
            ? query.cycle
              ? {
                  studentSections: {
                    some: {
                      section: { cycle: query.cycle },
                    },
                  },
                }
              : {}
            : query.departmentId
              ? { department: { id: query.departmentId } }
              : {}),
        },
        select: {
          id: true,
          usn: true,
          user: {
            select: { name: true },
          },
          registrations: {
            where: {
              semesterId: query.semesterId,
              academicTermId: query.academicTermId,
            },
            select: {
              id: true,
              registrationDate: true,
            },
          },
        },
        orderBy: { usn: "asc" },
      });

      const allItems: RegistrationTrackingStudentItem[] = students.map(
        (student) => {
          const hasRegistrations = student.registrations.length > 0;
          const earliestRegistration = hasRegistrations
            ? student.registrations[0]
            : null;

          return {
            studentId: student.id,
            studentName: student.user.name,
            usn: student.usn,
            isRegistered: hasRegistrations,
            registrationDate: earliestRegistration
              ? earliestRegistration.registrationDate.toISOString()
              : null,
            registeredCourseCount: student.registrations.length,
          };
        }
      );

      const statusFilter = query.statusFilter ?? "ALL";
      const filteredItems = allItems.filter((item) => {
        if (statusFilter === "REGISTERED") return item.isRegistered;
        if (statusFilter === "PENDING") return !item.isRegistered;
        return true;
      });

      return {
        status: "success",
        message: "Registration tracking data fetched successfully",
        data: filteredItems,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      logger.error("Failed to fetch registration tracking data", error);
      throw new Error("Failed to fetch registration tracking data");
    }
  }

  /**
   * Retrieve the full list of courses a specific student has registered for
   * in a given semester and academic term.
   */
  static async getStudentRegisteredCourses(
    studentId: string,
    semesterId: string,
    academicTermId: string
  ): Promise<BaseResponse<StudentRegisteredCourseItem[]>> {
    try {
      const student = await db.student.findUnique({
        where: { id: studentId },
        select: { id: true },
      });

      if (!student) {
        throw new Error("Student not found");
      }

      const registrations = await db.courseRegistration.findMany({
        where: {
          studentId,
          semesterId,
          academicTermId,
        },
        select: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              courseType: true,
              lectureCredits: true,
              tutorialCredits: true,
              practicalCredits: true,
              skillCredits: true,
              totalCredits: true,
            },
          },
        },
        orderBy: { course: { code: "asc" } },
      });

      const courses: StudentRegisteredCourseItem[] = registrations.map(
        (registration) => ({
          id: registration.course.id,
          code: registration.course.code,
          name: registration.course.name,
          courseType: registration.course.courseType,
          ltp: `${registration.course.lectureCredits}-${registration.course.tutorialCredits}-${registration.course.practicalCredits}-${registration.course.skillCredits}`,
          totalCredits: registration.course.totalCredits,
        })
      );

      return {
        status: "success",
        message: "Student registered courses fetched successfully",
        data: courses,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      logger.error("Failed to fetch student registered courses", error);
      throw new Error("Failed to fetch student registered courses");
    }
  }
}
