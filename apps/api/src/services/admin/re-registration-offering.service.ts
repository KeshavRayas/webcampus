import { logger } from "@webcampus/common/logger";
import { getTermLabel } from "@webcampus/common/term-label";
import { db } from "@webcampus/db";
import type {
  AssignReRegistrationStudentsType,
  CreateReRegistrationOfferingType,
  GetReRegistrationOfferingsQueryType,
} from "@webcampus/schemas/admin";
import type { BaseResponse } from "@webcampus/types/api";
import { isBatchManagedCourse } from "../shared/course-kind";

export type RROfferingCourseRef = {
  id: string;
  code: string;
  name: string;
};

export type RROfferingItem = {
  id: string;
  name: string;
  academicTermId: string;
  academicTermLabel: string;
  semesterId: string;
  semesterNumber: number;
  programType: string;
  courses: RROfferingCourseRef[];
  studentCount: number;
};

export class ReRegistrationOfferingService {
  static async createOffering(
    input: CreateReRegistrationOfferingType
  ): Promise<BaseResponse<RROfferingItem>> {
    try {
      const course = await db.course.findFirst({
        where: { id: input.courseId },
        select: {
          id: true,
          code: true,
          name: true,
          approvalStatus: true,
          courseType: true,
          departmentId: true,
          semester: {
            select: { programType: true, semesterNumber: true },
          },
        },
      });

      if (!course) {
        throw new Error("Course not found");
      }

      if (course.approvalStatus !== "APPROVED") {
        throw new Error(
          "Only approved courses can be offered for re-registration"
        );
      }

      if (isBatchManagedCourse(course.courseType)) {
        throw new Error(
          "Batch-managed courses are handled through elective batches and cannot be offered for re-registration"
        );
      }

      const hostSemester = await db.semester.findFirst({
        where: {
          academicTermId: input.academicTermId,
          programType: course.semester.programType,
          semesterNumber: course.semester.semesterNumber,
        },
        include: {
          academicTerm: {
            select: { id: true, type: true, parity: true, year: true },
          },
        },
      });

      if (!hostSemester) {
        throw new Error(
          `Host semester ${course.semester.semesterNumber} (${course.semester.programType}) was not found in the selected term`
        );
      }

      const trimmedName = input.name.trim();
      const existing = await db.section.findFirst({
        where: {
          name: trimmedName,
          departmentId: course.departmentId,
          semesterId: hostSemester.id,
        },
        select: { id: true },
      });

      if (existing) {
        throw new Error(
          "A re-registration offering section with this name already exists in this term"
        );
      }

      const section = await db.section.create({
        data: {
          name: trimmedName,
          departmentId: course.departmentId,
          semesterId: hostSemester.id,
          registrationType: "RE_REGISTRATION",
        },
        include: {
          semester: {
            select: {
              id: true,
              semesterNumber: true,
              programType: true,
              academicTerm: {
                select: { id: true, type: true, parity: true, year: true },
              },
            },
          },
          courses: {
            select: {
              course: { select: { id: true, code: true, name: true } },
            },
          },
          _count: { select: { studentSections: true } },
        },
      });

      logger.info(
        `Re-registration offering section created: ${section.name} for course ${course.code}`
      );

      return {
        status: "success",
        message: "Re-registration offering created successfully",
        data: ReRegistrationOfferingService.toItem(section),
      };
    } catch (error) {
      logger.error("Failed to create re-registration offering", { error });
      throw error;
    }
  }

  static async assignStudents(
    sectionId: string,
    input: AssignReRegistrationStudentsType
  ): Promise<BaseResponse<{ placedCount: number }>> {
    try {
      const section = await db.section.findUnique({
        where: { id: sectionId },
        select: {
          id: true,
          name: true,
          registrationType: true,
          semester: {
            select: {
              id: true,
              semesterNumber: true,
              academicTermId: true,
            },
          },
          courses: {
            select: { course: { select: { id: true, code: true } } },
          },
        },
      });

      if (!section) {
        throw new Error("Re-registration offering not found");
      }

      if (section.registrationType !== "RE_REGISTRATION") {
        throw new Error(
          "Only re-registration offering sections accept this enrollment"
        );
      }

      const assignedCourses = Array.from(
        new Set(section.courses.map((assignment) => assignment.course.id))
      );

      if (assignedCourses.length === 0) {
        throw new Error(
          "Assign faculty to this re-registration offering before enrolling students"
        );
      }

      if (assignedCourses.length > 1) {
        throw new Error(
          "This offering section is mapped to multiple courses and cannot be used for re-registration enrollment"
        );
      }

      const courseId = assignedCourses[0];
      if (!courseId) {
        throw new Error("Offering course could not be resolved");
      }

      const uniqueStudentIds = Array.from(new Set(input.studentIds));

      const existingMembers = await db.studentSection.findMany({
        where: {
          sectionId: section.id,
          semester: section.semester.semesterNumber,
          studentId: { in: uniqueStudentIds },
        },
        select: { studentId: true },
      });
      const alreadyPlaced = new Set(existingMembers.map((m) => m.studentId));

      const pendingStudentIds = uniqueStudentIds.filter(
        (studentId) => !alreadyPlaced.has(studentId)
      );

      if (pendingStudentIds.length === 0) {
        return {
          status: "success",
          message: "All selected students are already enrolled",
          data: { placedCount: 0 },
        };
      }

      const activeRegistrations = await db.courseRegistration.findMany({
        where: {
          studentId: { in: pendingStudentIds },
          courseId,
          academicTermId: section.semester.academicTermId,
          status: "ACTIVE",
          registrationType: "RE_REGISTRATION",
        },
        select: { studentId: true },
      });
      const registeredStudentIds = new Set(
        activeRegistrations.map((registration) => registration.studentId)
      );

      const unregisteredStudentIds = pendingStudentIds.filter(
        (studentId) => !registeredStudentIds.has(studentId)
      );

      if (unregisteredStudentIds.length > 0) {
        const unregisteredStudents = await db.student.findMany({
          where: { id: { in: unregisteredStudentIds } },
          select: { usn: true },
        });
        throw new Error(
          `These students have no active re-registration for ${section.courses[0]?.course.code ?? "this course"} in this term: ${unregisteredStudents
            .map((s) => s.usn)
            .join(", ")}`
        );
      }

      const placementAcademicYears = await db.student.findMany({
        where: { id: { in: pendingStudentIds } },
        select: { id: true, academicYear: true },
      });
      const academicYearByStudent = new Map(
        placementAcademicYears.map((s) => [s.id, s.academicYear])
      );

      await db.studentSection.createMany({
        data: pendingStudentIds.map((studentId) => ({
          studentId,
          sectionId: section.id,
          semester: section.semester.semesterNumber,
          academicYear: academicYearByStudent.get(studentId) ?? "",
        })),
      });

      logger.info(
        `Placed ${pendingStudentIds.length} student(s) into re-registration offering ${section.name}`
      );

      return {
        status: "success",
        message: "Students enrolled into the re-registration offering",
        data: { placedCount: pendingStudentIds.length },
      };
    } catch (error) {
      logger.error("Failed to enroll students into re-registration offering", {
        error,
      });
      throw error;
    }
  }

  static async getOfferings(
    query: GetReRegistrationOfferingsQueryType
  ): Promise<BaseResponse<RROfferingItem[]>> {
    try {
      const sections = await db.section.findMany({
        where: {
          registrationType: "RE_REGISTRATION",
          ...(query.academicTermId
            ? { semester: { academicTermId: query.academicTermId } }
            : {}),
        },
        include: {
          semester: {
            select: {
              id: true,
              semesterNumber: true,
              programType: true,
              academicTerm: {
                select: { id: true, type: true, parity: true, year: true },
              },
            },
          },
          courses: {
            select: {
              course: { select: { id: true, code: true, name: true } },
            },
          },
          _count: { select: { studentSections: true } },
        },
        orderBy: [{ semesterId: "asc" }, { name: "asc" }],
      });

      const items = sections
        .filter(
          (section) =>
            !query.courseId ||
            section.courses.some((a) => a.course.id === query.courseId)
        )
        .map((section) => ReRegistrationOfferingService.toItem(section));

      return {
        status: "success",
        message: "Re-registration offerings fetched successfully",
        data: items,
      };
    } catch (error) {
      logger.error("Failed to fetch re-registration offerings", { error });
      throw error;
    }
  }

  private static toItem(section: {
    id: string;
    name: string;
    semester: {
      id: string;
      semesterNumber: number;
      programType: string;
      academicTerm: {
        id: string;
        type: string;
        year: string;
        parity?: "odd" | "even" | null;
      };
    };
    courses: { course: { id: string; code: string; name: string } }[];
    _count: { studentSections: number };
  }): RROfferingItem {
    return {
      id: section.id,
      name: section.name,
      academicTermId: section.semester.academicTerm.id,
      academicTermLabel: getTermLabel(
        section.semester.academicTerm.type,
        section.semester.academicTerm.year,
        section.semester.academicTerm.parity
      ),
      semesterId: section.semester.id,
      semesterNumber: section.semester.semesterNumber,
      programType: section.semester.programType,
      courses: section.courses.map((assignment) => ({
        id: assignment.course.id,
        code: assignment.course.code,
        name: assignment.course.name,
      })),
      studentCount: section._count.studentSections,
    };
  }
}
