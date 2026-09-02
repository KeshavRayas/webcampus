import { logger } from "@webcampus/common/logger";
import { getTermLabel } from "@webcampus/common/term-label";
import { db } from "@webcampus/db";
import {
  CreateSupplementaryOfferingType,
  CreateSupplementarySectionType,
  GetSupplementaryRegistrationsQueryType,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { isRegistrationWindowOpen } from "../shared/academic-rules/academic-rules.service";
import type { WindowEvaluation } from "../shared/academic-rules/registration-rules";
import { isBatchManagedCourse } from "../shared/course-kind";

export interface SupplementaryOfferingItem {
  id: string;
  academicTermId: string;
  courseId: string;
  code: string;
  name: string;
  courseType: string;
  totalCredits: number;
}

export interface SupplementaryRegistrationItem {
  id: string;
  studentId: string;
  usn: string;
  studentName: string;
  courseId: string;
  code: string;
  courseName: string;
  totalCredits: number;
  semesterLabel: string;
  registrationDate: string;
}

export interface SupplementarySectionItem {
  id: string;
  name: string;
  offeringId: string;
  courseId: string;
  courseCode: string;
  semesterId: string;
  semesterNumber: number;
  programType: string;
  academicTermLabel: string;
  studentCount: number;
  courses: {
    id: string;
    code: string;
    name: string;
    facultyName: string | null;
  }[];
}
export interface SupplementaryDemandSectionSummary {
  id: string;
  name: string;
  studentCount: number;
  facultyNames: string[];
}

export interface SupplementaryDemandRow {
  offeringId: string;
  courseId: string;
  code: string;
  name: string;
  courseType: string;
  totalCredits: number;
  semesterNumber: number;
  programType: string;
  activeRegistrationCount: number;
  lastTaughtBy: string[];
  sections: SupplementaryDemandSectionSummary[];
  windowOpen: boolean;
}

export interface SupplementaryDemandOfferingInput {
  id: string;
  courseId: string;
  course: {
    code: string;
    name: string;
    courseType: string;
    totalCredits: number;
    semester: {
      id: string;
      semesterNumber: number;
      programType: string;
    } | null;
  };
}

export interface SupplementaryDemandQueryData {
  registrationsByCourse: Map<string, number>;
  facultyByCourse: Map<string, string[]>;
  sectionsByCourse: Map<string, SupplementaryDemandSectionSummary[]>;
  openWindowsByCourse: Map<string, boolean>;
}

export function buildSupplementaryDemandRows(
  offerings: SupplementaryDemandOfferingInput[],
  query: SupplementaryDemandQueryData
): SupplementaryDemandRow[] {
  return offerings.map((offering) => ({
    offeringId: offering.id,
    courseId: offering.courseId,
    code: offering.course.code,
    name: offering.course.name,
    courseType: offering.course.courseType,
    totalCredits: offering.course.totalCredits,
    semesterNumber: offering.course.semester?.semesterNumber ?? 0,
    programType: offering.course.semester?.programType ?? "UG",
    activeRegistrationCount:
      query.registrationsByCourse.get(offering.courseId) ?? 0,
    lastTaughtBy: query.facultyByCourse.get(offering.courseId) ?? [],
    sections: query.sectionsByCourse.get(offering.id) ?? [],
    windowOpen: query.openWindowsByCourse.get(offering.courseId) ?? false,
  }));
}

export function supplementaryWindowSettledMessage(
  evaluation: Pick<WindowEvaluation, "open" | "reason">
): string | null {
  return evaluation.open
    ? "Supplementary registration window is still open — close it before creating sections or placing students"
    : null;
}

export class SupplementaryService {
  static async getOfferings(
    academicTermId: string
  ): Promise<BaseResponse<SupplementaryOfferingItem[]>> {
    try {
      const term = await db.academicTerm.findUnique({
        where: { id: academicTermId },
        select: { id: true },
      });

      if (!term) {
        throw new Error("Academic term not found");
      }

      const offerings = await db.supplementaryCourseOffering.findMany({
        where: { academicTermId },
        orderBy: { course: { code: "asc" } },
        select: {
          id: true,
          academicTermId: true,
          courseId: true,
          course: {
            select: {
              code: true,
              name: true,
              courseType: true,
              totalCredits: true,
            },
          },
        },
      });

      return {
        status: "success",
        message: "Supplementary offerings fetched successfully",
        data: offerings.map((offering) => ({
          id: offering.id,
          academicTermId: offering.academicTermId,
          courseId: offering.courseId,
          code: offering.course.code,
          name: offering.course.name,
          courseType: offering.course.courseType,
          totalCredits: offering.course.totalCredits,
        })),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      logger.error("Failed to fetch supplementary offerings", error);
      throw new Error("Failed to fetch supplementary offerings");
    }
  }

  static async addOffering(
    input: CreateSupplementaryOfferingType
  ): Promise<BaseResponse<SupplementaryOfferingItem>> {
    try {
      const term = await db.academicTerm.findUnique({
        where: { id: input.academicTermId },
        select: { id: true, type: true, parity: true, year: true },
      });

      if (!term) {
        throw new Error("Academic term not found");
      }

      if (term.type !== "supplementary") {
        throw new Error(
          "Supplementary offerings can only be created in a supplementary term"
        );
      }

      const course = await db.course.findUnique({
        where: { id: input.courseId },
        select: {
          code: true,
          name: true,
          courseType: true,
          totalCredits: true,
          approvalStatus: true,
          semester: { select: { semesterNumber: true } },
        },
      });

      if (!course) {
        throw new Error("Course not found");
      }

      if (
        term.parity &&
        course.semester &&
        course.semester.semesterNumber % 2 !== (term.parity === "odd" ? 1 : 0)
      ) {
        throw new Error(
          `${course.code} belongs to Semester ${course.semester.semesterNumber} — offer it in an ${
            term.parity === "odd" ? "Odd" : "Even"
          } Supplementary term`
        );
      }

      if (course.approvalStatus !== "APPROVED") {
        throw new Error("Only approved courses can be offered");
      }

      const existing = await db.supplementaryCourseOffering.findUnique({
        where: {
          academicTermId_courseId: {
            academicTermId: input.academicTermId,
            courseId: input.courseId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        throw new Error("Course is already offered in this term");
      }

      const created = await db.supplementaryCourseOffering.create({
        data: {
          academicTermId: input.academicTermId,
          courseId: input.courseId,
        },
      });

      return {
        status: "success",
        message: "Supplementary offering added successfully",
        data: {
          id: created.id,
          academicTermId: created.academicTermId,
          courseId: created.courseId,
          code: course.code,
          name: course.name,
          courseType: course.courseType,
          totalCredits: course.totalCredits,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to add supplementary offering", error);
      throw new Error("Failed to add supplementary offering");
    }
  }

  static async removeOffering(id: string): Promise<BaseResponse<null>> {
    try {
      const existing = await db.supplementaryCourseOffering.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("Supplementary offering not found");
      }

      await db.supplementaryCourseOffering.delete({ where: { id } });

      return {
        status: "success",
        message: "Supplementary offering removed successfully",
        data: null,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to remove supplementary offering", error);
      throw new Error("Failed to remove supplementary offering");
    }
  }

  static async getRegistrations(
    query: GetSupplementaryRegistrationsQueryType
  ): Promise<BaseResponse<SupplementaryRegistrationItem[]>> {
    try {
      const registrations = await db.courseRegistration.findMany({
        where: {
          academicTermId: query.academicTermId,
          registrationType: "SUPPLEMENTARY",
          ...(query.courseId ? { courseId: query.courseId } : {}),
        },
        orderBy: { registrationDate: "desc" },
        select: {
          id: true,
          status: true,
          courseId: true,
          registrationDate: true,
          course: {
            select: { code: true, name: true, totalCredits: true },
          },
          semester: { select: { semesterNumber: true, programType: true } },
          student: {
            select: {
              id: true,
              usn: true,
              user: { select: { name: true } },
            },
          },
        },
      });

      return {
        status: "success",
        message: "Supplementary registrations fetched successfully",
        data: registrations.map((registration) => ({
          id: registration.id,
          studentId: registration.student.id,
          usn: registration.student.usn,
          studentName: registration.student.user.name,
          courseId: registration.courseId,
          code: registration.course.code,
          courseName: registration.course.name,
          totalCredits: registration.course.totalCredits,
          semesterLabel: `Sem ${registration.semester.semesterNumber}`,
          registrationDate: registration.registrationDate.toISOString(),
        })),
      };
    } catch (error) {
      logger.error("Failed to fetch supplementary registrations", error);
      throw new Error("Failed to fetch supplementary registrations");
    }
  }

  static async getDemandReport(
    academicTermId: string
  ): Promise<BaseResponse<SupplementaryDemandRow[]>> {
    try {
      const term = await db.academicTerm.findUnique({
        where: { id: academicTermId },
        select: { id: true, type: true },
      });

      if (!term) {
        throw new Error("Academic term not found");
      }

      if (term.type !== "supplementary") {
        throw new Error(
          "Demand report is only available for supplementary terms"
        );
      }

      const offerings = await db.supplementaryCourseOffering.findMany({
        where: { academicTermId },
        orderBy: { course: { code: "asc" } },
        select: {
          id: true,
          courseId: true,
          course: {
            select: {
              code: true,
              name: true,
              courseType: true,
              totalCredits: true,
              cycle: true,
              departmentId: true,
              semester: {
                select: { id: true, semesterNumber: true, programType: true },
              },
            },
          },
        },
      });

      const courseIds = offerings.map((offering) => offering.courseId);
      const offeringIds = offerings.map((offering) => offering.id);
      const originalSemesterIds = offerings
        .map((offering) => offering.course.semester?.id)
        .filter((id): id is string => Boolean(id));

      const [registrationGroups, assignments, supSections] = await Promise.all([
        db.courseRegistration.groupBy({
          by: ["courseId"],
          where: {
            academicTermId,
            registrationType: "SUPPLEMENTARY",
            status: "ACTIVE",
            courseId: { in: courseIds },
          },
          _count: { _all: true },
        }),
        db.courseAssignment.findMany({
          where: {
            courseId: { in: courseIds },
            section: { semesterId: { in: originalSemesterIds } },
          },
          select: {
            courseId: true,
            section: { select: { semesterId: true } },
            faculty: { select: { user: { select: { name: true } } } },
          },
        }),
        db.section.findMany({
          where: { supplementaryOfferingId: { in: offeringIds } },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            supplementaryOfferingId: true,
            _count: { select: { studentSections: true } },
            courses: {
              select: {
                faculty: { select: { user: { select: { name: true } } } },
              },
            },
          },
        }),
      ]);

      const registrationsByCourse = new Map<string, number>();
      for (const group of registrationGroups) {
        registrationsByCourse.set(group.courseId, group._count._all);
      }

      // "Last taught by" = faculty assigned to this course in the course's own
      // (original) semester — the same faculty auto-inherited on section creation.
      const facultyByCourse = new Map<string, string[]>();
      for (const offering of offerings) {
        const originalSemesterId = offering.course.semester?.id;
        if (!originalSemesterId) {
          continue;
        }
        const names = Array.from(
          new Set(
            assignments
              .filter(
                (assignment) =>
                  assignment.courseId === offering.courseId &&
                  assignment.section.semesterId === originalSemesterId
              )
              .map((assignment) => assignment.faculty.user.name)
          )
        );
        if (names.length > 0) {
          facultyByCourse.set(offering.courseId, names);
        }
      }

      const sectionsByCourse = new Map<
        string,
        SupplementaryDemandSectionSummary[]
      >();
      for (const section of supSections) {
        if (!section.supplementaryOfferingId) {
          continue;
        }
        const summaries =
          sectionsByCourse.get(section.supplementaryOfferingId) ?? [];
        summaries.push({
          id: section.id,
          name: section.name,
          studentCount: section._count.studentSections,
          facultyNames: Array.from(
            new Set(
              section.courses
                .map((assignment) => assignment.faculty?.user.name)
                .filter((name): name is string => Boolean(name))
            )
          ),
        });
        sectionsByCourse.set(section.supplementaryOfferingId, summaries);
      }

      // Window state per course — same scope the student registration flow
      // uses (host semester resolved by programType + semesterNumber).
      const hostSemesterCache = new Map<string, string | null>();
      const openWindowsByCourse = new Map<string, boolean>();
      for (const offering of offerings) {
        const semester = offering.course.semester;
        if (!semester) {
          openWindowsByCourse.set(offering.courseId, false);
          continue;
        }
        const scopeKey = `${semester.programType}:${semester.semesterNumber}`;
        let hostSemesterId = hostSemesterCache.get(scopeKey);
        if (hostSemesterId === undefined) {
          const hostSemester = await db.semester.findFirst({
            where: {
              academicTermId,
              programType: semester.programType,
              semesterNumber: semester.semesterNumber,
            },
            select: { id: true },
          });
          hostSemesterId = hostSemester?.id ?? null;
          hostSemesterCache.set(scopeKey, hostSemesterId);
        }
        if (!hostSemesterId) {
          openWindowsByCourse.set(offering.courseId, false);
          continue;
        }
        const evaluation = await isRegistrationWindowOpen({
          registrationType: "SUPPLEMENTARY",
          academicTermId,
          semesterId: hostSemesterId,
          departmentId: offering.course.departmentId,
          cycle: offering.course.cycle,
        });
        openWindowsByCourse.set(offering.courseId, evaluation.open);
      }

      return {
        status: "success",
        message: "Supplementary demand report fetched successfully",
        data: buildSupplementaryDemandRows(offerings, {
          registrationsByCourse,
          facultyByCourse,
          sectionsByCourse,
          openWindowsByCourse,
        }),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to build supplementary demand report", error);
      throw new Error("Failed to build supplementary demand report");
    }
  }

  static async createSupplementarySection(
    offeringId: string,
    input: CreateSupplementarySectionType
  ): Promise<BaseResponse<SupplementarySectionItem>> {
    try {
      const offering = await db.supplementaryCourseOffering.findUnique({
        where: { id: offeringId },
        select: {
          id: true,
          courseId: true,
          academicTermId: true,
          academicTerm: {
            select: {
              id: true,
              type: true,
              year: true,
            },
          },
          course: {
            select: {
              code: true,
              approvalStatus: true,
              courseType: true,
              cycle: true,
              departmentId: true,
              semester: {
                select: { programType: true, semesterNumber: true },
              },
            },
          },
        },
      });

      if (!offering) {
        throw new Error("Supplementary offering not found");
      }

      if (offering.academicTerm.type !== "supplementary") {
        throw new Error(
          "Sections can only be created for offerings in a supplementary term"
        );
      }

      if (offering.course.approvalStatus !== "APPROVED") {
        throw new Error("Only approved courses can be offered");
      }

      if (isBatchManagedCourse(offering.course.courseType)) {
        throw new Error(
          "Batch-managed courses are handled through elective batches and do not use sections"
        );
      }

      const hostSemester = await db.semester.findFirst({
        where: {
          academicTermId: offering.academicTermId,
          programType: offering.course.semester.programType,
          semesterNumber: offering.course.semester.semesterNumber,
        },
        select: { id: true },
      });

      if (!hostSemester) {
        throw new Error(
          `Host semester ${offering.course.semester.semesterNumber} (${offering.course.semester.programType}) was not found in the selected term`
        );
      }

      const windowEvaluation = await isRegistrationWindowOpen({
        registrationType: "SUPPLEMENTARY",
        academicTermId: offering.academicTermId,
        semesterId: hostSemester.id,
        departmentId: offering.course.departmentId,
        cycle: offering.course.cycle,
      });

      const gateMessage = supplementaryWindowSettledMessage(windowEvaluation);
      if (gateMessage) {
        throw new Error(gateMessage);
      }

      const name = input.name.trim();

      const existingByName = await db.section.findFirst({
        where: {
          name,
          departmentId: offering.course.departmentId,
          semesterId: hostSemester.id,
        },
        select: { id: true },
      });

      if (existingByName) {
        throw new Error("A section with this name already exists in this term");
      }

      const section = await db.section.create({
        data: {
          name,
          departmentId: offering.course.departmentId,
          semesterId: hostSemester.id,
          registrationType: "SUPPLEMENTARY",
          supplementaryOfferingId: offering.id,
          cycle: offering.course.cycle,
        },
      });

      // Hybrid (Card C): auto-inherit faculty mapping from original term's CourseAssignments.
      // Copies distinct THEORY assignments for the same course into the new SUP section,
      // mapping to the SUP host semester/year. Idempotent via unique constraint.
      try {
        const originalAssignments = await db.courseAssignment.findMany({
          where: {
            courseId: offering.courseId,
            assignmentType: "THEORY",
            batchId: null,
          },
          select: {
            facultyId: true,
            departmentId: true,
            assignmentType: true,
          },
        });

        const distinctFacultyIds = Array.from(
          new Set(originalAssignments.map((a) => a.facultyId))
        );

        if (distinctFacultyIds.length > 0) {
          const supSemester = await db.semester.findUnique({
            where: { id: hostSemester.id },
            select: {
              semesterNumber: true,
              academicTerm: { select: { year: true } },
            },
          });

          const semesterNumber =
            supSemester?.semesterNumber ??
            offering.course.semester.semesterNumber;
          const academicYear =
            supSemester?.academicTerm.year ?? offering.academicTerm.year;

          for (const facultyId of distinctFacultyIds) {
            try {
              await db.courseAssignment.create({
                data: {
                  courseId: offering.courseId,
                  departmentId: offering.course.departmentId,
                  facultyId,
                  sectionId: section.id,
                  batchId: null,
                  assignmentType: "THEORY",
                  semester: semesterNumber,
                  academicYear,
                },
              });
            } catch (e: unknown) {
              if (
                typeof e === "object" &&
                e !== null &&
                "code" in e &&
                (e as { code?: string }).code === "P2002"
              ) {
                // already inherited — idempotent
                continue;
              }
              throw e;
            }
          }

          if (distinctFacultyIds.length > 0) {
            logger.info(
              "Supplementary section auto-inherited faculty mapping",
              {
                sectionId: section.id,
                offeringId: offering.id,
                courseId: offering.courseId,
                facultyCount: distinctFacultyIds.length,
              }
            );
          }
        }
      } catch (inheritError) {
        // Non-fatal: section is already created; log and continue so the API still returns success
        logger.warn("Failed to auto-inherit supplementary faculty mapping", {
          offeringId: offering.id,
          sectionId: section.id,
          error:
            inheritError instanceof Error
              ? inheritError.message
              : String(inheritError),
        });
      }

      const created = await db.section.findUnique({
        where: { id: section.id },
        include: {
          _count: { select: { studentSections: true } },
          semester: {
            select: {
              semesterNumber: true,
              programType: true,
              academicTerm: {
                select: { id: true, type: true, parity: true, year: true },
              },
            },
          },
          courses: {
            select: {
              id: true,
              course: { select: { code: true, name: true } },
              faculty: { select: { user: { select: { name: true } } } },
            },
          },
        },
      });

      if (!created) {
        throw new Error("Failed to load created supplementary section");
      }

      return {
        status: "success",
        message: "Supplementary section created successfully",
        data: {
          id: created.id,
          name: created.name,
          offeringId: offering.id,
          courseId: offering.courseId,
          courseCode: offering.course.code,
          semesterId: created.semesterId,
          semesterNumber: created.semester.semesterNumber,
          programType: created.semester.programType,
          academicTermLabel: getTermLabel(
            created.semester.academicTerm.type,
            created.semester.academicTerm.year,
            created.semester.academicTerm.parity
          ),
          studentCount: created._count.studentSections,
          courses: created.courses.map((assignment) => ({
            id: assignment.id,
            code: assignment.course.code,
            name: assignment.course.name,
            facultyName: assignment.faculty?.user.name ?? null,
          })),
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to create supplementary section", error);
      throw new Error("Failed to create supplementary section");
    }
  }

  static async getSupplementarySections(
    offeringId: string
  ): Promise<BaseResponse<SupplementarySectionItem[]>> {
    try {
      const offering = await db.supplementaryCourseOffering.findUnique({
        where: { id: offeringId },
        select: {
          id: true,
          courseId: true,
          course: { select: { code: true } },
        },
      });

      if (!offering) {
        throw new Error("Supplementary offering not found");
      }

      const sections = await db.section.findMany({
        where: { supplementaryOfferingId: offering.id },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { studentSections: true } },
          semester: {
            select: {
              semesterNumber: true,
              programType: true,
              academicTerm: {
                select: { id: true, type: true, parity: true, year: true },
              },
            },
          },
          courses: {
            select: {
              id: true,
              course: { select: { code: true, name: true } },
              faculty: { select: { user: { select: { name: true } } } },
            },
          },
        },
      });

      return {
        status: "success",
        message: "Supplementary sections fetched successfully",
        data: sections.map((section) => ({
          id: section.id,
          name: section.name,
          offeringId: offering.id,
          courseId: offering.courseId,
          courseCode:
            section.courses.at(0)?.course.code ?? offering.course.code,
          semesterId: section.semesterId,
          semesterNumber: section.semester.semesterNumber,
          programType: section.semester.programType,
          academicTermLabel: getTermLabel(
            section.semester.academicTerm.type,
            section.semester.academicTerm.year,
            section.semester.academicTerm.parity
          ),
          studentCount: section._count.studentSections,
          courses: section.courses.map((assignment) => ({
            id: assignment.id,
            code: assignment.course.code,
            name: assignment.course.name,
            facultyName: assignment.faculty?.user.name ?? null,
          })),
        })),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to fetch supplementary sections", error);
      throw new Error("Failed to fetch supplementary sections");
    }
  }

  static async assignStudents(
    sectionId: string,
    input: { studentIds: string[] }
  ): Promise<BaseResponse<{ placedCount: number }>> {
    try {
      const section = await db.section.findFirst({
        where: { id: sectionId },
        select: {
          id: true,
          registrationType: true,
          supplementaryOffering: {
            select: {
              courseId: true,
              academicTermId: true,
              course: {
                select: {
                  departmentId: true,
                  cycle: true,
                  semester: {
                    select: { semesterNumber: true, programType: true },
                  },
                },
              },
            },
          },
          semester: { select: { semesterNumber: true, academicTermId: true } },
        },
      });

      if (!section) {
        throw new Error("Supplementary section not found");
      }

      if (section.registrationType !== "SUPPLEMENTARY") {
        throw new Error(
          "Students can only be assigned to supplementary sections"
        );
      }

      if (!section.supplementaryOffering) {
        throw new Error(
          "This section is not linked to a supplementary offering"
        );
      }

      const hostSemesterRef = section.supplementaryOffering.course.semester;
      if (!hostSemesterRef) {
        throw new Error("Host semester not found for supplementary offering");
      }

      const gateHostSemester = await db.semester.findFirst({
        where: {
          academicTermId: section.semester.academicTermId,
          programType: hostSemesterRef.programType,
          semesterNumber: hostSemesterRef.semesterNumber,
        },
        select: { id: true },
      });

      if (!gateHostSemester) {
        throw new Error(
          `Host semester ${hostSemesterRef.semesterNumber} (${hostSemesterRef.programType}) was not found in the selected term`
        );
      }

      const evaluation = await isRegistrationWindowOpen({
        registrationType: "SUPPLEMENTARY",
        academicTermId: section.semester.academicTermId,
        semesterId: gateHostSemester.id,
        departmentId: section.supplementaryOffering.course.departmentId,
        cycle: section.supplementaryOffering.course.cycle,
      });

      const gateMessage = supplementaryWindowSettledMessage(evaluation);
      if (gateMessage) {
        throw new Error(gateMessage);
      }

      const uniqueStudentIds = Array.from(new Set(input.studentIds));

      const alreadyPlaced = await db.studentSection.findMany({
        where: { sectionId, studentId: { in: uniqueStudentIds } },
        select: { studentId: true },
      });

      const placedIds = new Set(alreadyPlaced.map((row) => row.studentId));
      const pending = uniqueStudentIds.filter((id) => !placedIds.has(id));

      if (pending.length === 0) {
        return {
          status: "success",
          message: "All selected students are already enrolled",
          data: { placedCount: 0 },
        };
      }

      const activeSupplementary = await db.courseRegistration.findMany({
        where: {
          studentId: { in: pending },
          courseId: section.supplementaryOffering.courseId,
          academicTermId: section.semester.academicTermId,
          status: "ACTIVE",
          registrationType: "SUPPLEMENTARY",
        },
        select: { studentId: true, student: { select: { usn: true } } },
      });

      if (activeSupplementary.length !== pending.length) {
        const registered = new Set(
          activeSupplementary.map((row) => row.studentId)
        );
        const students = await db.student.findMany({
          where: { id: { in: pending } },
          select: { id: true, usn: true },
        });
        const unregistered = students
          .filter((student) => !registered.has(student.id))
          .map((student) => student.usn);

        throw new Error(
          `Students without an active supplementary registration for this course: ${unregistered.join(", ")}`
        );
      }

      const students = await db.student.findMany({
        where: { id: { in: pending } },
        select: { id: true, academicYear: true },
      });

      await db.studentSection.createMany({
        data: students.map((student) => ({
          studentId: student.id,
          sectionId,
          semester: section.semester.semesterNumber,
          academicYear: student.academicYear ?? "",
        })),
      });

      logger.info("Students placed into supplementary section", {
        sectionId,
        count: students.length,
      });

      return {
        status: "success",
        message: "Students placed into supplementary section successfully",
        data: { placedCount: students.length },
      };
    } catch (error) {
      logger.error(
        "Failed to place students into supplementary section",
        error
      );
      throw error;
    }
  }
}
