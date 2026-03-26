import { logger } from "@webcampus/common/logger";
import { db, Prisma, Section } from "@webcampus/db";
import {
  CreateSectionType,
  DetailedGenerationPreviewSectionDTO,
  GenerateCycleSectionsDTO,
  GenerateSectionsDTO,
  SectionAllocationDTO,
  SectionQueryType,
  SectionResponseType,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

type SectionCycle = "PHYSICS" | "CHEMISTRY";

interface DetailedSectionPlan {
  sectionName: string;
  studentUsns: string[];
  studentIds: string[];
}

const UNAUTHORIZED_FIRST_YEAR_MESSAGE =
  "First-year sections are managed by the Basic Sciences department.";

const isRestrictedUgFirstYearSemester = (semester: {
  semesterNumber: number;
  programType: "UG" | "PG";
}) =>
  semester.programType === "UG" &&
  (semester.semesterNumber === 1 || semester.semesterNumber === 2);

export class SectionService {
  private static async getRequestingDepartment(requestingUserId: string) {
    const department = await db.department.findFirst({
      where: { userId: requestingUserId },
      select: { id: true, name: true, type: true },
    });

    if (!department) {
      throw new Error("Requesting department not found");
    }

    return department;
  }

  static async assertSemesterWriteAccess(
    semesterId: string,
    requestingUserId: string
  ): Promise<void> {
    const [semester, department] = await Promise.all([
      db.semester.findUnique({
        where: { id: semesterId },
        select: { semesterNumber: true, programType: true },
      }),
      this.getRequestingDepartment(requestingUserId),
    ]);

    if (!semester) {
      throw new Error("Semester not found");
    }

    if (
      department.type !== "BASIC_SCIENCES" &&
      isRestrictedUgFirstYearSemester(semester)
    ) {
      throw new Error(UNAUTHORIZED_FIRST_YEAR_MESSAGE);
    }
  }

  static async assertSectionWriteAccess(
    sectionId: string,
    requestingUserId: string
  ): Promise<void> {
    const section = await db.section.findUnique({
      where: { id: sectionId },
      include: {
        semester: {
          select: {
            semesterNumber: true,
            programType: true,
          },
        },
      },
    });

    if (!section) {
      throw new Error("Section not found");
    }

    const department = await this.getRequestingDepartment(requestingUserId);
    if (
      department.type !== "BASIC_SCIENCES" &&
      isRestrictedUgFirstYearSemester(section.semester)
    ) {
      throw new Error(UNAUTHORIZED_FIRST_YEAR_MESSAGE);
    }
  }

  private static async buildDetailedSectionPlan(
    semesterId: string,
    allocations: SectionAllocationDTO[],
    cycle: SectionCycle,
    studentsPerSection: number
  ): Promise<DetailedSectionPlan[]> {
    const semester = await db.semester.findUnique({
      where: { id: semesterId },
      include: { academicTerm: true },
    });

    if (!semester) throw new Error("Semester not found");
    if (!semester.academicTerm) throw new Error("Academic term not found");

    const validAllocations = allocations.filter(
      (allocation) => allocation.selected && allocation.count > 0
    );

    if (validAllocations.length === 0) {
      return [];
    }

    const pooledStudents: { id: string; usn: string }[] = [];

    for (const allocation of validAllocations) {
      const students = await db.student.findMany({
        where: {
          department: {
            is: {
              id: allocation.departmentId,
            },
          },
          currentSemester: semester.semesterNumber,
          studentSections: {
            none: {
              academicYear: semester.academicTerm.year,
              section: {
                semesterId,
              },
            },
          },
        },
        orderBy: { usn: "asc" },
        take: allocation.count,
        select: {
          id: true,
          usn: true,
        },
      });

      pooledStudents.push(...students);
    }

    if (pooledStudents.length === 0) {
      return [];
    }

    const existingCycleSections = await db.section.findMany({
      where: {
        semesterId,
        cycle,
      },
      select: { id: true },
    });

    const sectionPrefix = cycle === "PHYSICS" ? "P" : "C";
    const sectionStartIndex = existingCycleSections.length;
    const numberOfSections = Math.ceil(
      pooledStudents.length / studentsPerSection
    );

    const sectionPlans: DetailedSectionPlan[] = [];
    let cursor = 0;

    for (let index = 0; index < numberOfSections; index++) {
      const sectionName = `${sectionPrefix}${String.fromCharCode(65 + sectionStartIndex + index)}`;
      const chunk = pooledStudents.slice(cursor, cursor + studentsPerSection);
      cursor += studentsPerSection;

      sectionPlans.push({
        sectionName,
        studentUsns: chunk.map((student) => student.usn),
        studentIds: chunk.map((student) => student.id),
      });
    }

    return sectionPlans;
  }

  static async getDetailedGenerationPreview(
    semesterId: string,
    allocations: SectionAllocationDTO[],
    cycle: SectionCycle,
    studentsPerSection = 60,
    requestingUserId?: string
  ): Promise<BaseResponse<DetailedGenerationPreviewSectionDTO[]>> {
    try {
      if (requestingUserId) {
        await this.assertSemesterWriteAccess(semesterId, requestingUserId);
      }

      const sectionPlans = await this.buildDetailedSectionPlan(
        semesterId,
        allocations,
        cycle,
        studentsPerSection
      );

      return {
        status: "success",
        message: "Detailed generation preview fetched successfully",
        data: sectionPlans.map((plan) => ({
          sectionName: plan.sectionName,
          studentUsns: plan.studentUsns,
        })),
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching detailed generation preview:", { error });
      throw new Error("Failed to fetch detailed generation preview");
    }
  }

  static async create(
    data: CreateSectionType,
    requestingUserId?: string
  ): Promise<BaseResponse<SectionResponseType>> {
    try {
      if (requestingUserId) {
        await this.assertSemesterWriteAccess(data.semesterId, requestingUserId);
      }

      const section = await db.section.create({
        data,
      });

      const response: BaseResponse<SectionResponseType> = {
        status: "success",
        message: "Section created successfully",
        data: section,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Section already exists");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Error creating section:", { error });
      throw new Error("Failed to create section");
    }
  }

  static async getAll(
    query: SectionQueryType,
    requestingUserId?: string
  ): Promise<BaseResponse<SectionResponseType[]>> {
    try {
      const whereClause: Prisma.SectionWhereInput = {
        ...query,
      };

      if (requestingUserId) {
        const requestingDepartment =
          await this.getRequestingDepartment(requestingUserId);

        if (requestingDepartment.type !== "BASIC_SCIENCES") {
          const existingNotFilters = Array.isArray(whereClause.NOT)
            ? whereClause.NOT
            : whereClause.NOT
              ? [whereClause.NOT]
              : [];

          whereClause.NOT = [
            ...existingNotFilters,
            {
              semester: {
                programType: "UG",
                semesterNumber: {
                  in: [1, 2],
                },
              },
            },
          ];
        }
      }

      const sections = await db.section.findMany({
        where: whereClause,
      });
      const response: BaseResponse<SectionResponseType[]> = {
        status: "success",
        message: "Sections retrieved successfully",
        data: sections,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("No sections found");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Error retrieving sections:", { error });
      throw new Error("Failed to retrieve sections");
    }
  }

  static async getById(id: string): Promise<BaseResponse<SectionResponseType>> {
    try {
      const section = await db.section.findUnique({
        where: { id },
        include: {
          department: true,
          courses: true,
          studentSections: true,
          batches: true,
        },
      });

      if (!section) {
        throw new Error("Section not found");
      }

      const response: BaseResponse<SectionResponseType> = {
        status: "success",
        message: "Section retrieved successfully",
        data: section,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error retrieving section:", { error });
      throw new Error("Failed to retrieve section");
    }
  }

  static async deleteSection(id: string): Promise<BaseResponse<void>> {
    try {
      await db.$transaction(async (tx) => {
        const section = await tx.section.findUnique({
          where: { id },
          select: {
            id: true,
            _count: {
              select: {
                courses: true,
                batches: true,
              },
            },
          },
        });

        if (!section) {
          throw new Error("Section not found");
        }

        if (section._count.courses > 0 || section._count.batches > 0) {
          throw new Error(
            "Cannot delete section with assigned courses or batches. Remove them first."
          );
        }

        await tx.studentSection.deleteMany({
          where: { sectionId: id },
        });

        await tx.section.delete({
          where: { id },
        });
      });

      const response: BaseResponse<void> = {
        status: "success",
        message: "Section deleted successfully and students unassigned",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error deleting section:", { error });
      throw new Error("Failed to delete section");
    }
  }

  /**
   * Get the count of students not yet assigned to any section
   * for a given semester + department.
   */
  static async getUnassignedCount(
    semesterId: string,
    departmentName: string,
    requestingUserId?: string
  ): Promise<BaseResponse<{ count: number; semesterNumber: number }>> {
    try {
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      if (requestingUserId) {
        const requestingDepartment =
          await this.getRequestingDepartment(requestingUserId);

        if (
          requestingDepartment.type !== "BASIC_SCIENCES" &&
          isRestrictedUgFirstYearSemester(semester)
        ) {
          throw new Error(UNAUTHORIZED_FIRST_YEAR_MESSAGE);
        }
      }

      // Find existing section IDs for this semester + department
      const existingSections = await db.section.findMany({
        where: { semesterId, departmentName },
        select: { id: true },
      });
      const existingSectionIds = existingSections.map((s) => s.id);

      // Count students in this department+semester that are NOT in any section
      const count = await db.student.count({
        where: {
          departmentName,
          currentSemester: semester.semesterNumber,
          ...(existingSectionIds.length > 0
            ? {
                studentSections: {
                  none: {
                    sectionId: { in: existingSectionIds },
                  },
                },
              }
            : {}),
        },
      });

      return {
        status: "success",
        message: "Unassigned student count fetched",
        data: { count, semesterNumber: semester.semesterNumber },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching unassigned count:", { error });
      throw new Error("Failed to fetch unassigned student count");
    }
  }

  static async getUnassignedStudentCounts(
    termId: string,
    semesterNumber: number
  ): Promise<
    BaseResponse<
      {
        departmentId: string;
        departmentName: string;
        abbreviation: string;
        unassignedCount: number;
      }[]
    >
  > {
    try {
      const departments = await db.department.findMany({
        where: { type: "DEGREE_GRANTING" },
        select: {
          id: true,
          name: true,
          abbreviation: true,
        },
        orderBy: { abbreviation: "asc" },
      });

      const counts = await Promise.all(
        departments.map(async (department) => {
          const unassignedCount = await db.student.count({
            where: {
              departmentName: department.name,
              currentSemester: semesterNumber,
              studentSections: {
                none: {
                  section: {
                    semester: {
                      academicTermId: termId,
                    },
                  },
                },
              },
            },
          });

          return {
            departmentId: department.id,
            departmentName: department.name,
            abbreviation: department.abbreviation,
            unassignedCount,
          };
        })
      );

      return {
        status: "success",
        message: "Unassigned student counts fetched successfully",
        data: counts,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching unassigned student counts:", { error });
      throw new Error("Failed to fetch unassigned student counts");
    }
  }

  /**
   * Auto-generate sections and assign students using a transaction.
   */
  static async generateSections(
    data: GenerateSectionsDTO,
    requestingUserId?: string
  ): Promise<BaseResponse<Section[]>> {
    try {
      const {
        semesterId,
        departmentName,
        studentsPerSection,
        academicYear,
        cycle,
        allocations,
      } = data;

      const semester = await db.semester.findUnique({
        where: { id: semesterId },
        include: { academicTerm: true },
      });
      if (!semester) throw new Error("Semester not found");
      if (!semester.academicTerm) throw new Error("Academic term not found");

      const termId = semester.academicTermId;
      const semesterNumber = semester.semesterNumber;

      // Access guard: only BASIC_SCIENCES can generate UG sem 1-2
      if (requestingUserId) {
        const dept = await this.getRequestingDepartment(requestingUserId);
        if (
          dept.type !== "BASIC_SCIENCES" &&
          isRestrictedUgFirstYearSemester(semester)
        ) {
          throw new Error(UNAUTHORIZED_FIRST_YEAR_MESSAGE);
        }
      }

      // Find existing section IDs for this semester + department
      const existingSections = await db.section.findMany({
        where: { semesterId, departmentName },
        select: { id: true },
      });

      if (cycle && allocations && allocations.length > 0) {
        const sectionPlans = await this.buildDetailedSectionPlan(
          semesterId,
          allocations,
          cycle,
          studentsPerSection
        );

        if (sectionPlans.length === 0) {
          throw new Error("No students selected for section generation");
        }

        const createdCycleSections = await db.$transaction(async (tx) => {
          const sections: Section[] = [];

          for (const plan of sectionPlans) {
            const section = await tx.section.create({
              data: {
                name: plan.sectionName,
                departmentName,
                semesterId,
                cycle,
              },
            });

            await tx.studentSection.createMany({
              data: plan.studentIds.map((studentId) => ({
                studentId,
                sectionId: section.id,
                semester: semesterNumber,
                academicYear,
              })),
            });

            sections.push(section);
          }

          return sections;
        });

        return {
          status: "success",
          message: `Generated ${createdCycleSections.length} sections in ${cycle} cycle`,
          data: createdCycleSections,
        };
      }

      // Fetch unassigned students: must not have SectionAssignment for this term
      // Students are ordered by USN for consistent "First N" selection
      const unassignedStudents = await db.student.findMany({
        where: {
          departmentName,
          currentSemester: semesterNumber,
          studentSections: {
            none: {
              section: {
                semester: {
                  academicTermId: termId,
                },
              },
            },
          },
        },
        orderBy: { usn: "asc" },
      });

      if (unassignedStudents.length === 0) {
        throw new Error(
          "No unassigned students found for this semester and department"
        );
      }

      // Chunk students
      const chunks: (typeof unassignedStudents)[] = [];
      for (let i = 0; i < unassignedStudents.length; i += studentsPerSection) {
        chunks.push(unassignedStudents.slice(i, i + studentsPerSection));
      }

      // Determine starting letter offset from existing sections
      const startIndex = existingSections.length;

      // Transaction: create sections + assign students
      const createdSections = await db.$transaction(async (tx) => {
        const sections: Section[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const sectionName = `${semesterNumber}${String.fromCharCode(65 + startIndex + i)}`;

          const section = await tx.section.create({
            data: {
              name: sectionName,
              departmentName,
              semesterId,
            },
          });

          await tx.studentSection.createMany({
            data: chunks[i]!.map((student) => ({
              studentId: student.id,
              sectionId: section.id,
              semester: semesterNumber,
              academicYear,
            })),
          });

          sections.push(section);
        }

        return sections;
      });

      return {
        status: "success",
        message: `Generated ${createdSections.length} sections with ${unassignedStudents.length} students assigned`,
        data: createdSections,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error(
            "Section name conflict: some sections already exist for this semester"
          );
        }
      }
      if (error instanceof Error) throw error;
      logger.error("Error generating sections:", { error });
      throw new Error("Failed to generate sections");
    }
  }

  /**
   * Get sections with nested student data for display cards.
   */
  static async getSectionsWithStudents(
    semesterId: string,
    departmentName: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const sections = await db.section.findMany({
        where: { semesterId, departmentName },
        include: {
          studentSections: {
            include: {
              student: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: { studentSections: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return {
        status: "success",
        message: "Sections with students fetched successfully",
        data: sections,
      };
    } catch (error) {
      logger.error("Error fetching sections with students:", { error });
      throw new Error("Failed to fetch sections with students");
    }
  }

  /**
   * Get students not yet assigned to any section for a given semester + department.
   * Returns full student data with user info for UI display.
   */
  static async getUnassignedStudents(
    semesterId: string,
    departmentName: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const existingSections = await db.section.findMany({
        where: { semesterId, departmentName },
        select: { id: true },
      });
      const existingSectionIds = existingSections.map((s) => s.id);

      const students = await db.student.findMany({
        where: {
          departmentName,
          currentSemester: semester.semesterNumber,
          ...(existingSectionIds.length > 0
            ? {
                studentSections: {
                  none: {
                    sectionId: { in: existingSectionIds },
                  },
                },
              }
            : {}),
        },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { usn: "asc" },
      });

      return {
        status: "success",
        message: "Unassigned students fetched successfully",
        data: students,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching unassigned students:", { error });
      throw new Error("Failed to fetch unassigned students");
    }
  }

  /**
   * Assign specific students to a section by creating StudentSection records.
   */
  static async assignStudentsToSection(
    sectionId: string,
    studentIds: string[],
    academicYear: string
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      const section = await db.section.findUnique({
        where: { id: sectionId },
        include: { semester: true },
      });
      if (!section) throw new Error("Section not found");

      const result = await db.studentSection.createMany({
        data: studentIds.map((studentId) => ({
          studentId,
          sectionId,
          semester: section.semester.semesterNumber,
          academicYear,
        })),
        skipDuplicates: true,
      });

      return {
        status: "success",
        message: `${result.count} student(s) assigned to section ${section.name}`,
        data: { count: result.count },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Some students are already assigned to this section");
        }
      }
      if (error instanceof Error) throw error;
      logger.error("Error assigning students to section:", { error });
      throw new Error("Failed to assign students to section");
    }
  }

  /**
   * Generate cycle-based sections for BASIC_SCIENCES (First Year).
   * Supports PHYSICS/CHEMISTRY cycle assignment and 50/50 splits.
   * Section naming: Physics → PA, PB... Chemistry → CA, CB...
   */
  static async generateCycleSections(
    data: GenerateCycleSectionsDTO,
    requestingDepartmentName: string,
    requestingUserId?: string
  ): Promise<BaseResponse<Section[]>> {
    try {
      const {
        termId,
        semesterId,
        semesterNumber,
        cycle,
        studentsPerSection,
        academicYear,
        allocations,
      } = data;

      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      if (requestingUserId) {
        await this.assertSemesterWriteAccess(semesterId, requestingUserId);
      }

      const semNum = semester.semesterNumber;

      if (semNum !== semesterNumber) {
        throw new Error("Selected semester does not match semester number");
      }

      if (semester.academicTermId !== termId) {
        throw new Error("Selected term does not match semester");
      }

      if (semNum !== 1 && semNum !== 2) {
        throw new Error(
          "Cycle-based section generation is only available for semesters 1 and 2"
        );
      }

      const selectedAllocations = allocations.filter(
        (allocation) => allocation.selected && allocation.count > 0
      );

      if (selectedAllocations.length === 0) {
        throw new Error("Select at least one department with a valid count");
      }

      const sectionPlans = await this.buildDetailedSectionPlan(
        semesterId,
        selectedAllocations,
        cycle,
        studentsPerSection
      );

      if (sectionPlans.length === 0) {
        throw new Error("No students selected for section generation");
      }

      const createdSections = await db.$transaction(async (tx) => {
        const sections: Section[] = [];

        for (const plan of sectionPlans) {
          const section = await tx.section.create({
            data: {
              name: plan.sectionName,
              departmentName: requestingDepartmentName,
              semesterId,
              cycle,
            },
          });

          await tx.studentSection.createMany({
            data: plan.studentIds.map((studentId) => ({
              studentId,
              sectionId: section.id,
              semester: semNum,
              academicYear,
            })),
          });

          sections.push(section);
        }

        return sections;
      });

      return {
        status: "success",
        message: `Generated ${createdSections.length} sections in ${cycle} cycle`,
        data: createdSections,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error(
            "Section name conflict: some cycle sections already exist"
          );
        }
      }
      if (error instanceof Error) throw error;
      logger.error("Error generating cycle sections:", { error });
      throw new Error("Failed to generate cycle sections");
    }
  }

  /**
   * Promote first-year sections from Sem 1 → Sem 2 with cycle swap.
   * PHYSICS sections become CHEMISTRY and vice versa (PA → CA, CA → PA).
   */
  static async promoteFirstYearSections(
    fromSemesterId: string,
    toSemesterId: string,
    academicYear: string
  ): Promise<BaseResponse<Section[]>> {
    try {
      const fromSemester = await db.semester.findUnique({
        where: { id: fromSemesterId },
      });
      const toSemester = await db.semester.findUnique({
        where: { id: toSemesterId },
      });
      if (!fromSemester || !toSemester)
        throw new Error("Source or target semester not found");
      if (
        fromSemester.semesterNumber !== 1 ||
        toSemester.semesterNumber !== 2
      ) {
        throw new Error(
          "Promotion is only supported from semester 1 to semester 2"
        );
      }

      const sem1Sections = await db.section.findMany({
        where: { semesterId: fromSemesterId },
        include: {
          studentSections: { select: { studentId: true } },
        },
      });

      if (sem1Sections.length === 0) {
        throw new Error("No sections found in the source semester");
      }

      const createdSections = await db.$transaction(async (tx) => {
        const newSections: Section[] = [];

        for (const oldSection of sem1Sections) {
          // Swap cycle
          const newCycle =
            oldSection.cycle === "PHYSICS"
              ? "CHEMISTRY"
              : oldSection.cycle === "CHEMISTRY"
                ? "PHYSICS"
                : oldSection.cycle;

          // Swap name prefix: P↔C
          const newName = oldSection.name.startsWith("P")
            ? `C${oldSection.name.slice(1)}`
            : oldSection.name.startsWith("C")
              ? `P${oldSection.name.slice(1)}`
              : oldSection.name;

          const newSection = await tx.section.create({
            data: {
              name: newName,
              departmentName: oldSection.departmentName,
              semesterId: toSemesterId,
              cycle: newCycle,
            },
          });

          // Migrate students
          if (oldSection.studentSections.length > 0) {
            await tx.studentSection.createMany({
              data: oldSection.studentSections.map((ss) => ({
                studentId: ss.studentId,
                sectionId: newSection.id,
                semester: 2,
                academicYear,
              })),
            });
          }

          newSections.push(newSection);
        }

        return newSections;
      });

      return {
        status: "success",
        message: `Promoted ${createdSections.length} sections from Sem 1 → Sem 2 with cycle swap`,
        data: createdSections,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error promoting first year sections:", { error });
      throw new Error("Failed to promote first year sections");
    }
  }
}
