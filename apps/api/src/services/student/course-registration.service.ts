import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  CourseRegistrationResponseType,
  CreateCourseRegistrationType,
} from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";

type StudentContext = {
  id: string;
  currentSemester: number;
  academicYear: string;
  studentSections: { sectionId: string }[];
  batches: { id: string }[];
};

export type EligibleCourseType = {
  courseId: string;
  code: string;
  name: string;
  totalCredits: number;
  semester: number;
  academicYear: string;
  courseType: string;
  courseMode: string;
  isRegistered: boolean;
};

export class CourseRegistration {
  private static async getStudentContextByUserId(userId: string): Promise<StudentContext> {
    const student = await db.student.findUnique({
      where: { userId },
      select: {
        id: true,
        currentSemester: true,
        academicYear: true,
        studentSections: {
          select: {
            sectionId: true,
          },
        },
        batches: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!student) {
      throw new Error("Student profile not found");
    }

    return student;
  }

  private static async ensureEligibilityForCourse(
    student: StudentContext,
    request: CreateCourseRegistrationType
  ): Promise<void> {
    if (
      student.currentSemester !== request.semester ||
      student.academicYear !== request.academicYear
    ) {
      throw new Error("Registration is allowed only for your current semester");
    }

    const sectionIds = student.studentSections.map((item) => item.sectionId);
    const batchIds = student.batches.map((item) => item.id);

    if (sectionIds.length === 0 && batchIds.length === 0) {
      throw new Error("No assigned section or batch found for registration");
    }

    const assignment = await db.courseAssignment.findFirst({
      where: {
        courseId: request.courseId,
        semester: request.semester,
        academicYear: request.academicYear,
        course: {
          approvalStatus: "APPROVED",
        },
        OR: [
          {
            assignmentType: "THEORY",
            sectionId: {
              in: sectionIds,
            },
          },
          {
            assignmentType: "LAB",
            batchId: {
              in: batchIds,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      throw new Error("Course is not approved or not assigned to you");
    }
  }

  static async createForStudent(
    userId: string,
    request: CreateCourseRegistrationType
  ): Promise<BaseResponse<CourseRegistrationResponseType>> {
    try {
      const student = await this.getStudentContextByUserId(userId);
      await this.ensureEligibilityForCourse(student, request);

      const registration = await db.courseRegistration.create({
        data: {
          studentId: student.id,
          courseId: request.courseId,
          semester: request.semester,
          academicYear: request.academicYear,
        },
      });

      return {
        status: "success",
        message: "Course registration created successfully",
        data: registration,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("You are already registered for this course");
      }
      logger.error("Error creating course registration:", { error });
      throw error;
    }
  }

  static async getByStudentUserId(
    userId: string
  ): Promise<BaseResponse<CourseRegistrationResponseType[]>> {
    try {
      const student = await this.getStudentContextByUserId(userId);

      const registrations = await db.courseRegistration.findMany({
        where: { studentId: student.id },
        orderBy: {
          course: {
            code: "asc",
          },
        },
      });

      return {
        status: "success",
        message: "Course registrations retrieved successfully",
        data: registrations,
      };
    } catch (error) {
      logger.error("Error retrieving course registrations:", { error });
      throw error;
    }
  }

  static async getEligibleCoursesForStudent(
    userId: string
  ): Promise<BaseResponse<EligibleCourseType[]>> {
    try {
      const student = await this.getStudentContextByUserId(userId);
      const sectionIds = student.studentSections.map((item) => item.sectionId);
      const batchIds = student.batches.map((item) => item.id);

      const assignments = await db.courseAssignment.findMany({
        where: {
          semester: student.currentSemester,
          academicYear: student.academicYear,
          course: {
            approvalStatus: "APPROVED",
          },
          OR: [
            {
              assignmentType: "THEORY",
              sectionId: {
                in: sectionIds,
              },
            },
            {
              assignmentType: "LAB",
              batchId: {
                in: batchIds,
              },
            },
          ],
        },
        select: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              totalCredits: true,
              courseType: true,
              courseMode: true,
            },
          },
        },
      });

      const registrations = await db.courseRegistration.findMany({
        where: {
          studentId: student.id,
          semester: student.currentSemester,
          academicYear: student.academicYear,
        },
        select: {
          courseId: true,
        },
      });

      const registeredCourseIds = new Set(registrations.map((item) => item.courseId));
      const uniqueCourses = new Map<string, EligibleCourseType>();

      assignments.forEach((assignment) => {
        const course = assignment.course;
        if (uniqueCourses.has(course.id)) {
          return;
        }

        uniqueCourses.set(course.id, {
          courseId: course.id,
          code: course.code,
          name: course.name,
          totalCredits: course.totalCredits,
          semester: student.currentSemester,
          academicYear: student.academicYear,
          courseType: course.courseType,
          courseMode: course.courseMode,
          isRegistered: registeredCourseIds.has(course.id),
        });
      });

      const data = Array.from(uniqueCourses.values()).sort((a, b) =>
        a.code.localeCompare(b.code)
      );

      return {
        status: "success",
        message: "Eligible courses retrieved successfully",
        data,
      };
    } catch (error) {
      logger.error("Error retrieving eligible courses:", { error });
      throw error;
    }
  }
}
