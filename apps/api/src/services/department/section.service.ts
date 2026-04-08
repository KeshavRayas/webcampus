import { logger } from "@webcampus/common/logger";
import { db, Prisma, Section } from "@webcampus/db";
import { DepartmentContextResolver } from "@webcampus/api/src/services/shared/department-context-resolver.service";
import {
  CreateSectionType,
  DetailedGenerationPreviewSectionDTO,
  GenerateCycleSectionsDTO,
  GenerateSectionsDTO,
  SectionAllocationDTO,
  SectionQueryType,
  SectionResponseType,
} from "@webcampus/schemas/department";
import type { DepartmentRequestContext } from "@webcampus/types/request-context";
import { BaseResponse } from "@webcampus/types/api";

type SectionCycle = "PHYSICS" | "CHEMISTRY";

interface DetailedSectionPlan {
  sectionName: string;
  studentUsns: string[];
  studentIds: string[];
}

type SectionWithDepartmentContext = Section & {
  departmentId: string;
  departmentName: string | null;
};

const UNAUTHORIZED_FIRST_YEAR_MESSAGE =
  "First-year sections are managed by the Basic Sciences department.";

const isRestrictedUgFirstYearSemester = (semester: {
  semesterNumber: number;
  programType: "UG" | "PG";
}) =>
  semester.programType === "UG" &&
  (semester.semesterNumber === 1 || semester.semesterNumber === 2);

export class SectionService {
  private static async resolveDepartmentContext(input: {
    source: string;
    departmentId?: string;
    departmentName?: string;
    requestContext?: DepartmentRequestContext;
  }) {
    if (input.requestContext?.departmentId) {
      return DepartmentContextResolver.resolve({
        source: input.source,
        departmentId: input.requestContext.departmentId,
        departmentName: input.requestContext.departmentName,
      });
    }

    return DepartmentContextResolver.resolve({
      source: input.source,
      departmentId: input.departmentId,
      departmentName: input.departmentName,
    });
  }

  private static async getRequestingDepartment(
    requestingUserId: string,
    requestContext?: DepartmentRequestContext
  ) {
    if (requestContext?.departmentId) {
      const department = await db.department.findUnique({
        where: { id: requestContext.departmentId },
        select: { id: true, name: true, type: true },
      });

      if (!department) {
        throw new Error("Requesting department not found");
      }

      return department;
    }

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
    requestingUserId: string,
    requestContext?: DepartmentRequestContext
  ): Promise<void> {
    const [semester, department] = await Promise.all([
      db.semester.findUnique({
        where: { id: semesterId },
        select: { semesterNumber: true, programType: true },
      }),
      this.getRequestingDepartment(requestingUserId, requestContext),
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
    requestingUserId: string,
    requestContext?: DepartmentRequestContext
  ): Promise<void> {
    const department = await this.getRequestingDepartment(
      requestingUserId,
      requestContext
    );

    const section = await db.section.findFirst({
      where: {
        id: sectionId,
        department: {
          is: {
            id: department.id,
          },
        },
      },
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

    const departmentIds = [
      ...new Set(validAllocations.map((a) => a.departmentId)),
    ];
    const departments = await db.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true },
    });
    const allStudents = await db.student.findMany({
      where: {
        department: {
          is: {
            id: {
              in: departmentIds,
            },
          },
        },
        currentSemester: semester.semesterNumber,
        studentSections: {
          none: {
            section: {
              semester: {
                academicTermId: semester.academicTermId,
              },
            },
          },
        },
      },
      orderBy: [{ departmentName: "asc" }, { usn: "asc" }],
      select: {
        id: true,
        usn: true,
        department: {
          select: {
            id: true,
          },
        },
      },
    });

    const studentsByDepartmentId = new Map<
      string,
      { id: string; usn: string }[]
    >();

    for (const student of allStudents) {
      const students = studentsByDepartmentId.get(student.department.id) ?? [];
      students.push({ id: student.id, usn: student.usn });
      studentsByDepartmentId.set(student.department.id, students);
    }

    const departmentCursorById = new Map<string, number>();
    const pooledStudents: { id: string; usn: string }[] = [];

    for (const allocation of validAllocations) {
      if (!departments.some((department) => department.id === allocation.departmentId)) {
        continue;
      }

      const students = studentsByDepartmentId.get(allocation.departmentId) ?? [];
      const cursor = departmentCursorById.get(allocation.departmentId) ?? 0;
      const selectedStudents = students.slice(cursor, cursor + allocation.count);
      departmentCursorById.set(allocation.departmentId, cursor + allocation.count);

      pooledStudents.push(...selectedStudents);
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
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<DetailedGenerationPreviewSectionDTO[]>> {
    try {
      if (requestingUserId) {
        const requestingDepartment = await this.getRequestingDepartment(
          requestingUserId,
          requestContext
        );
        await DepartmentContextResolver.resolve({
          source: "section.getDetailedGenerationPreview",
          departmentId: requestingDepartment.id,
        });
        await this.assertSemesterWriteAccess(
          semesterId,
          requestingUserId,
          requestContext
        );
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
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<SectionResponseType>> {
    try {
      if (requestingUserId) {
        await this.assertSemesterWriteAccess(
          data.semesterId,
          requestingUserId,
          requestContext
        );
      }

      const resolvedDepartment = await this.resolveDepartmentContext({
        source: "section.create",
        departmentName: data.departmentName,
        requestContext,
      });

      const section = await db.section.create({
        data: {
          ...data,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
        },
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
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<SectionResponseType[]>> {
    try {
      const requestingDepartment = requestingUserId
        ? await this.getRequestingDepartment(requestingUserId, requestContext)
        : null;

      const whereClause: Prisma.SectionWhereInput = {
        ...(query.semesterId ? { semesterId: query.semesterId } : {}),
        ...(query.cycle
          ? { cycle: query.cycle as import("@webcampus/db").Cycle }
          : {}),
        ...(query.name ? { name: query.name } : {}),
        ...(requestingDepartment
          ? {
              department: {
                is: {
                  id: requestingDepartment.id,
                },
              },
            }
          : {}),
      };

      if (requestingDepartment?.type !== "BASIC_SCIENCES") {
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

  static async getById(
    id: string,
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<SectionResponseType>> {
    try {
      const requestingDepartment = requestingUserId
        ? await this.getRequestingDepartment(requestingUserId, requestContext)
        : null;

      const section = await db.section.findFirst({
        where: {
          id,
          ...(requestingDepartment
            ? {
                department: {
                  is: {
                    id: requestingDepartment.id,
                  },
                },
              }
            : {}),
        },
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

  static async deleteSection(
    id: string,
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<void>> {
    try {
      const requestingDepartment = requestingUserId
        ? await this.getRequestingDepartment(requestingUserId, requestContext)
        : null;

      await db.$transaction(async (tx) => {
        const section = await tx.section.findFirst({
          where: {
            id,
            ...(requestingDepartment
              ? {
                  department: {
                    is: {
                      id: requestingDepartment.id,
                    },
                  },
                }
              : {}),
          },
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
    departmentId?: string,
    departmentName?: string,
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<
    BaseResponse<{
      count: number;
      semesterNumber: number;
      departmentId: string;
      departmentName: string;
    }>
  > {
    try {
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const resolvedDepartment = await this.resolveDepartmentContext({
        source: "section.getUnassignedCount",
        departmentId,
        departmentName,
        requestContext,
      });

      if (requestingUserId) {
        const requestingDepartment =
          await this.getRequestingDepartment(requestingUserId, requestContext);

        if (
          requestingDepartment.type !== "BASIC_SCIENCES" &&
          resolvedDepartment.departmentId !== requestingDepartment.id
        ) {
          throw new Error("Forbidden: department scope mismatch");
        }

        if (
          requestingDepartment.type !== "BASIC_SCIENCES" &&
          isRestrictedUgFirstYearSemester(semester)
        ) {
          throw new Error(UNAUTHORIZED_FIRST_YEAR_MESSAGE);
        }
      }

      // Find existing section IDs for this semester + department
      const existingSections = await db.section.findMany({
        where: {
          semesterId,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
        },
        select: { id: true },
      });
      const existingSectionIds = existingSections.map((s) => s.id);

      // Count students in this department+semester that are NOT in any section
      const count = await db.student.count({
        where: {
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
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
        data: {
          count,
          semesterNumber: semester.semesterNumber,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
        },
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
              department: {
                is: {
                  id: department.id,
                },
              },
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
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<SectionWithDepartmentContext[]>> {
    try {
      const {
        semesterId,
        departmentId,
        departmentName,
        studentsPerSection,
        academicYear,
        cycle,
        allocations,
      } = data;

      const resolvedDepartment = await this.resolveDepartmentContext({
        source: "section.generateSections",
        departmentId,
        departmentName,
        requestContext,
      });

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
        const dept = await this.getRequestingDepartment(
          requestingUserId,
          requestContext
        );

        if (
          dept.type !== "BASIC_SCIENCES" &&
          dept.id !== resolvedDepartment.departmentId
        ) {
          throw new Error("Forbidden: department scope mismatch");
        }

        if (
          dept.type !== "BASIC_SCIENCES" &&
          isRestrictedUgFirstYearSemester(semester)
        ) {
          throw new Error(UNAUTHORIZED_FIRST_YEAR_MESSAGE);
        }
      }

      // Find existing section IDs for this semester + department
      const existingSections = await db.section.findMany({
        where: {
          semesterId,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
        },
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
                departmentId: resolvedDepartment.departmentId,
                departmentName: resolvedDepartment.departmentName,
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

            // Allocate students to lab batches (roundrobin across all batches for the section)
            const batches = await tx.batch.findMany({
              where: { sectionId: section.id },
              orderBy: { name: "asc" },
            });

            if (batches.length > 0) {
              for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const studentsForBatch = plan.studentIds.filter(
                  (_, studentIndex) => studentIndex % batches.length === batchIndex
                );

                if (studentsForBatch.length > 0) {
                  await tx.batch.update({
                    where: { id: batches[batchIndex]!.id },
                    data: {
                      students: {
                        connect: studentsForBatch.map((studentId) => ({ id: studentId })),
                      },
                    },
                  });
                }
              }
            }

            sections.push(section);
          }

          return sections;
        });

        return {
          status: "success",
          message: `Generated ${createdCycleSections.length} sections in ${cycle} cycle`,
          data: createdCycleSections.map((section) => ({
            ...section,
            departmentId: resolvedDepartment.departmentId,
            departmentName: resolvedDepartment.departmentName,
          })),
        };
      }

      // Fetch unassigned students: must not have SectionAssignment for this term
      // Students are ordered by USN for consistent "First N" selection
      const unassignedStudents = await db.student.findMany({
        where: {
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
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
              departmentId: resolvedDepartment.departmentId,
              departmentName: resolvedDepartment.departmentName,
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

          // Allocate students to lab batches (roundrobin across all batches for the section)
          const batches = await tx.batch.findMany({
            where: { sectionId: section.id },
            orderBy: { name: "asc" },
          });

          if (batches.length > 0) {
            const chunkStudentIds = chunks[i]!.map((student) => student.id);
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
              const studentsForBatch = chunkStudentIds.filter(
                (_, studentIndex) => studentIndex % batches.length === batchIndex
              );

              if (studentsForBatch.length > 0) {
                await tx.batch.update({
                  where: { id: batches[batchIndex]!.id },
                  data: {
                    students: {
                      connect: studentsForBatch.map((studentId) => ({ id: studentId })),
                    },
                  },
                });
              }
            }
          }

          sections.push(section);
        }

        return sections;
      });

      return {
        status: "success",
        message: `Generated ${createdSections.length} sections with ${unassignedStudents.length} students assigned`,
        data: createdSections.map((section) => ({
          ...section,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
        })),
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
    departmentId?: string,
    departmentName?: string,
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const resolvedDepartment = await this.resolveDepartmentContext({
        source: "section.getSectionsWithStudents",
        departmentId,
        departmentName,
        requestContext,
      });

      if (requestingUserId) {
        const requestingDepartment =
          await this.getRequestingDepartment(requestingUserId, requestContext);

        if (
          requestingDepartment.type !== "BASIC_SCIENCES" &&
          requestingDepartment.id !== resolvedDepartment.departmentId
        ) {
          throw new Error("Forbidden: department scope mismatch");
        }
      }

      const sections = await db.section.findMany({
        where: {
          semesterId,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
        },
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
        data: {
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
          sections,
        },
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
    departmentId?: string,
    departmentName?: string,
    requestingUserId?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const resolvedDepartment = await this.resolveDepartmentContext({
        source: "section.getUnassignedStudents",
        departmentId,
        departmentName,
        requestContext,
      });

      if (requestingUserId) {
        const requestingDepartment =
          await this.getRequestingDepartment(requestingUserId, requestContext);

        if (
          requestingDepartment.type !== "BASIC_SCIENCES" &&
          requestingDepartment.id !== resolvedDepartment.departmentId
        ) {
          throw new Error("Forbidden: department scope mismatch");
        }
      }

      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const existingSections = await db.section.findMany({
        where: {
          semesterId,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
        },
        select: { id: true },
      });
      const existingSectionIds = existingSections.map((s) => s.id);

      const students = await db.student.findMany({
        where: {
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
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
        data: {
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
          students,
        },
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

      if (studentIds.length === 0) {
        return {
          status: "success",
          message: `0 student(s) assigned to section ${section.name}`,
          data: { count: 0 },
        };
      }

      const normalizedStudentIds = Array.from(new Set(studentIds));
      const students = await db.student.findMany({
        where: {
          id: { in: normalizedStudentIds },
        },
        select: {
          id: true,
          department: {
            select: {
              id: true,
            },
          },
        },
      });

      if (students.length !== normalizedStudentIds.length) {
        throw new Error("One or more students are invalid");
      }

      const outOfDepartmentStudent = students.find(
        (student) => student.department.id !== section.departmentId
      );

      if (outOfDepartmentStudent) {
        throw new Error(
          "Student and Section do not belong to the same department"
        );
      }

      const result = await db.studentSection.createMany({
        data: normalizedStudentIds.map((studentId) => ({
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
    requestingUserId: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<SectionWithDepartmentContext[]>> {
    try {
      const {
        termId,
        semesterId,
        semesterNumber,
        departmentId,
        departmentName,
        cycle,
        studentsPerSection,
        academicYear,
        allocations,
      } = data;

      const requestingDepartment = await this.getRequestingDepartment(
        requestingUserId,
        requestContext
      );
      const resolvedDepartment = await this.resolveDepartmentContext({
        source: "section.generateCycleSections",
        departmentId: departmentId ?? requestingDepartment.id,
        departmentName,
        requestContext,
      });

      if (resolvedDepartment.departmentId !== requestingDepartment.id) {
        throw new Error("Forbidden: department scope mismatch");
      }

      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      await this.assertSemesterWriteAccess(
        semesterId,
        requestingUserId,
        requestContext
      );

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
              departmentId: resolvedDepartment.departmentId,
              departmentName: resolvedDepartment.departmentName,
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
        data: createdSections.map((section) => ({
          ...section,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
        })),
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
              departmentId: oldSection.departmentId,
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
