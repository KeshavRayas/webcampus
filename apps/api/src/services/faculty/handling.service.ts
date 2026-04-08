import { logger } from "@webcampus/common/logger";
import { db, type AssignmentType, type Prisma } from "@webcampus/db";
import type { BaseResponse } from "@webcampus/types/api";

type FacultyHandlingQueryInput = {
  search?: string;
  academicTermId?: string;
  programType?: "UG" | "PG";
  semesterId?: string;
  sectionId?: string;
  batchId?: string;
  academicYear?: string;
  page?: number;
  limit?: number;
  academicTerm?: string;
  semester?: number | string;
  section?: string;
  batch?: string;
};

type PaginationMetadata = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMetadata;
};

type FacultyHandlingAssignmentDTO = {
  assignmentId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  semesterNumber: number;
  section: string;
  batchName?: string;
  assignmentType: AssignmentType;
  studentCount: number;
};

type FacultyHandlingStudentDTO = {
  studentId: string;
  usn: string;
  name: string;
  email: string;
  section: string;
  batchName?: string;
  semesterNumber: number;
};

type FacultyHandlingFilterOptionsDTO = {
  academicTerms: {
    id: string;
    year: string;
    type: "odd" | "even";
  }[];
  semesters: {
    id: string;
    academicTermId: string;
    programType: "UG" | "PG";
    semesterNumber: number;
  }[];
  sections: {
    id: string;
    name: string;
    semesterId: string;
  }[];
};

type NormalizedFilters = {
  search?: string;
  academicTermId?: string;
  programType?: "UG" | "PG";
  semesterId?: string;
  sectionId?: string;
  batchId?: string;
  academicYear?: string;
  semesterNumber?: number;
  page: number;
  limit: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
};

const toLegacySemesterNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
};

const normalizeFilters = (filters: FacultyHandlingQueryInput): NormalizedFilters => {
  const page = toPositiveInteger(filters.page, DEFAULT_PAGE);
  const limit = toPositiveInteger(filters.limit, DEFAULT_LIMIT);

  return {
    search: toTrimmedString(filters.search),
    academicTermId: toTrimmedString(filters.academicTermId ?? filters.academicTerm),
    programType: filters.programType,
    semesterId: toTrimmedString(filters.semesterId),
    sectionId: toTrimmedString(filters.sectionId ?? filters.section),
    batchId: toTrimmedString(filters.batchId ?? filters.batch),
    academicYear: toTrimmedString(filters.academicYear),
    semesterNumber: toLegacySemesterNumber(filters.semester),
    page,
    limit,
  };
};

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

const buildSectionFilter = (sectionId: string): Prisma.CourseAssignmentWhereInput => {
  if (isUuid(sectionId)) {
    return {
      OR: [
        { sectionId },
        { section: { name: { contains: sectionId, mode: "insensitive" } } },
      ],
    };
  }

  return {
    section: { name: { contains: sectionId, mode: "insensitive" } },
  };
};

const buildBatchFilter = (batchId: string): Prisma.CourseAssignmentWhereInput => {
  if (isUuid(batchId)) {
    return {
      OR: [{ batchId }, { batch: { name: { contains: batchId, mode: "insensitive" } } }],
    };
  }

  return {
    batch: { name: { contains: batchId, mode: "insensitive" } },
  };
};

const buildPaginationMetadata = (
  total: number,
  page: number,
  limit: number
): PaginationMetadata => {
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

const buildPaginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  return {
    items,
    pagination: buildPaginationMetadata(total, page, limit),
  };
};

const matchesIdentifierOrName = (
  value: { id: string; name?: string | null } | null | undefined,
  filter: string
): boolean => {
  if (!value) {
    return false;
  }

  if (value.id === filter) {
    return true;
  }

  if (value.name) {
    return value.name.toLowerCase().includes(filter.toLowerCase());
  }

  return false;
};

const buildAssignmentWhere = (
  facultyId: string,
  assignmentType: AssignmentType,
  filters: NormalizedFilters
): Prisma.CourseAssignmentWhereInput => {
  const andConditions: Prisma.CourseAssignmentWhereInput[] = [
    { facultyId },
    { assignmentType },
    { course: { approvalStatus: "APPROVED" } },
    ...(assignmentType === "LAB" ? [{ batchId: { not: null } }] : []),
  ];

  if (filters.academicTermId) {
    andConditions.push({ course: { semester: { academicTermId: filters.academicTermId } } });
  }

  if (filters.programType) {
    andConditions.push({ course: { semester: { programType: filters.programType } } });
  }

  if (filters.semesterId) {
    andConditions.push({ course: { semesterId: filters.semesterId } });
    andConditions.push({ section: { semesterId: filters.semesterId } });
  }

  if (filters.semesterNumber !== undefined) {
    andConditions.push({ semester: filters.semesterNumber });
  }

  if (filters.academicYear) {
    andConditions.push({ academicYear: filters.academicYear });
  }

  if (filters.sectionId) {
    andConditions.push(buildSectionFilter(filters.sectionId));
  }

  if (filters.batchId) {
    andConditions.push(buildBatchFilter(filters.batchId));
  }

  if (filters.search) {
    andConditions.push({
      OR: [
        { course: { code: { contains: filters.search, mode: "insensitive" } } },
        { course: { name: { contains: filters.search, mode: "insensitive" } } },
        { section: { name: { contains: filters.search, mode: "insensitive" } } },
        { batch: { name: { contains: filters.search, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: andConditions };
};

type OwnedApprovedAssignment = {
  id: string;
  facultyId: string;
  assignmentType: AssignmentType;
  semester: number;
  academicYear: string;
  sectionId: string;
  batchId: string | null;
  course: {
    id: string;
    code: string;
    name: string;
    semesterId: string;
    semesterNumber: number;
    semester: {
      id: string;
      academicTermId: string;
      programType: "UG" | "PG";
    };
    approvalStatus: "APPROVED" | "PENDING" | "DRAFT" | "NEEDS_REVISION";
  };
  section: {
    id: string;
    name: string;
    semesterId: string;
  };
  batch: {
    id: string;
    name: string;
  } | null;
};

export class FacultyHandlingService {
  private static async getFacultyIdByUserId(userId: string): Promise<string> {
    const faculty = await db.faculty.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    return faculty.id;
  }

  private static async getOwnedApprovedAssignment(
    facultyId: string,
    assignmentId: string,
    assignmentType: AssignmentType
  ): Promise<OwnedApprovedAssignment> {
    const assignment = await db.courseAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        facultyId: true,
        assignmentType: true,
        semester: true,
        academicYear: true,
        sectionId: true,
        batchId: true,
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            semesterId: true,
            semesterNumber: true,
            approvalStatus: true,
            semester: {
              select: {
                id: true,
                academicTermId: true,
                programType: true,
              },
            },
          },
        },
        section: {
          select: {
            id: true,
            name: true,
            semesterId: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    if (assignment.facultyId !== facultyId) {
      throw new Error("Forbidden: assignment does not belong to current faculty");
    }

    if (assignment.assignmentType !== assignmentType) {
      throw new Error("Forbidden: assignment type mismatch for this endpoint");
    }

    if (assignment.course.approvalStatus !== "APPROVED") {
      throw new Error("Assignment course is not approved");
    }

    return assignment;
  }

  static async getHandlingAssignments(
    userId: string,
    assignmentType: AssignmentType,
    query: FacultyHandlingQueryInput
  ): Promise<BaseResponse<PaginatedResponse<FacultyHandlingAssignmentDTO>>> {
    try {
      const facultyId = await FacultyHandlingService.getFacultyIdByUserId(userId);
      const filters = normalizeFilters(query);
      const where = buildAssignmentWhere(facultyId, assignmentType, filters);
      const skip = (filters.page - 1) * filters.limit;

      const [total, assignments] = await Promise.all([
        db.courseAssignment.count({ where }),
        db.courseAssignment.findMany({
          where,
          skip,
          take: filters.limit,
          orderBy: [
            { semester: "desc" },
            { academicYear: "desc" },
            { course: { code: "asc" } },
          ],
          select: {
            id: true,
            assignmentType: true,
            semester: true,
            academicYear: true,
            section: {
              select: {
                id: true,
                name: true,
                semesterId: true,
              },
            },
            course: {
              select: {
                id: true,
                code: true,
                name: true,
                semesterNumber: true,
                semester: {
                  select: {
                    academicTermId: true,
                    programType: true,
                  },
                },
              },
            },
            batch: {
              select: {
                id: true,
                name: true,
                _count: {
                  select: {
                    students: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const items: FacultyHandlingAssignmentDTO[] = await Promise.all(
        assignments.map(async (assignment) => {
          let studentCount = assignment.batch?._count.students ?? 0;

          if (assignment.assignmentType === "THEORY") {
            studentCount = await db.studentSection.count({
              where: {
                sectionId: assignment.section.id,
                semester: assignment.semester,
                academicYear: assignment.academicYear,
              },
            });
          }

          return {
            assignmentId: assignment.id,
            courseId: assignment.course.id,
            courseCode: assignment.course.code,
            courseName: assignment.course.name,
            semesterNumber: assignment.semester,
            section: assignment.section.name,
            batchName: assignment.batch?.name,
            assignmentType: assignment.assignmentType,
            studentCount,
          };
        })
      );

      return {
        status: "success",
        message: "Faculty handling assignments fetched successfully",
        data: buildPaginatedResponse(items, total, filters.page, filters.limit),
      };
    } catch (error) {
      logger.error("Error fetching faculty handling assignments", { error });
      throw error;
    }
  }

  static async getFilterOptions(
    userId: string,
    assignmentType: AssignmentType
  ): Promise<BaseResponse<FacultyHandlingFilterOptionsDTO>> {
    try {
      const facultyId = await FacultyHandlingService.getFacultyIdByUserId(userId);

      const assignments = await db.courseAssignment.findMany({
        where: {
          facultyId,
          assignmentType,
          course: {
            approvalStatus: "APPROVED",
          },
        },
        select: {
          section: {
            select: {
              id: true,
              name: true,
              semesterId: true,
            },
          },
          course: {
            select: {
              semester: {
                select: {
                  id: true,
                  semesterNumber: true,
                  programType: true,
                  academicTerm: {
                    select: {
                      id: true,
                      year: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const termMap = new Map<
        string,
        { id: string; year: string; type: "odd" | "even" }
      >();
      const semesterMap = new Map<
        string,
        {
          id: string;
          academicTermId: string;
          programType: "UG" | "PG";
          semesterNumber: number;
        }
      >();
      const sectionMap = new Map<string, { id: string; name: string; semesterId: string }>();

      for (const assignment of assignments) {
        const semester = assignment.course.semester;
        const academicTerm = semester.academicTerm;

        termMap.set(academicTerm.id, {
          id: academicTerm.id,
          year: academicTerm.year,
          type: academicTerm.type,
        });

        semesterMap.set(semester.id, {
          id: semester.id,
          academicTermId: academicTerm.id,
          programType: semester.programType,
          semesterNumber: semester.semesterNumber,
        });

        sectionMap.set(assignment.section.id, {
          id: assignment.section.id,
          name: assignment.section.name,
          semesterId: assignment.section.semesterId,
        });
      }

      const academicTerms = Array.from(termMap.values()).sort((a, b) => {
        const yearComparison = b.year.localeCompare(a.year, undefined, {
          numeric: true,
          sensitivity: "base",
        });

        if (yearComparison !== 0) {
          return yearComparison;
        }

        const termPriority: Record<"odd" | "even", number> = {
          odd: 0,
          even: 1,
        };

        return termPriority[a.type] - termPriority[b.type];
      });

      const termOrder = new Map(academicTerms.map((term, index) => [term.id, index]));

      const semesters = Array.from(semesterMap.values()).sort((a, b) => {
        const aTermOrder = termOrder.get(a.academicTermId) ?? Number.MAX_SAFE_INTEGER;
        const bTermOrder = termOrder.get(b.academicTermId) ?? Number.MAX_SAFE_INTEGER;

        if (aTermOrder !== bTermOrder) {
          return aTermOrder - bTermOrder;
        }

        const programTypePriority: Record<"UG" | "PG", number> = {
          UG: 0,
          PG: 1,
        };

        if (a.programType !== b.programType) {
          return programTypePriority[a.programType] - programTypePriority[b.programType];
        }

        return a.semesterNumber - b.semesterNumber;
      });

      const sections = Array.from(sectionMap.values()).sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });

      return {
        status: "success",
        message: "Faculty handling filter options fetched successfully",
        data: {
          academicTerms,
          semesters,
          sections,
        },
      };
    } catch (error) {
      logger.error("Error fetching faculty handling filter options", { error });
      throw error;
    }
  }

  static async getStudentsByAssignment(
    userId: string,
    assignmentId: string,
    assignmentType: AssignmentType,
    query: FacultyHandlingQueryInput
  ): Promise<BaseResponse<PaginatedResponse<FacultyHandlingStudentDTO>>> {
    try {
      const facultyId = await FacultyHandlingService.getFacultyIdByUserId(userId);
      const assignment = await FacultyHandlingService.getOwnedApprovedAssignment(
        facultyId,
        assignmentId,
        assignmentType
      );

      if (assignment.assignmentType === "LAB" && !assignment.batchId) {
        throw new Error("Invalid assignment: LAB assignment must have a batch");
      }

      const filters = normalizeFilters(query);

      if (filters.academicTermId && assignment.course.semester.academicTermId !== filters.academicTermId) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (filters.programType && assignment.course.semester.programType !== filters.programType) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (filters.semesterId && assignment.course.semesterId !== filters.semesterId) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (filters.semesterNumber !== undefined && assignment.semester !== filters.semesterNumber) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (filters.academicYear && assignment.academicYear !== filters.academicYear) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (filters.sectionId && !matchesIdentifierOrName(assignment.section, filters.sectionId)) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (
        filters.batchId &&
        assignment.assignmentType === "LAB" &&
        !matchesIdentifierOrName(assignment.batch, filters.batchId)
      ) {
        throw new Error("Assignment not found for the provided filters");
      }

      const search = filters.search;
      const skip = (filters.page - 1) * filters.limit;

      const studentConditions: Prisma.StudentWhereInput[] = [];

      if (search) {
        studentConditions.push({
          OR: [
            { usn: { contains: search, mode: "insensitive" as const } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        });
      }

      if (assignment.assignmentType === "THEORY") {
        studentConditions.push({
          studentSections: {
            some: {
              sectionId: assignment.sectionId,
              semester: assignment.semester,
              academicYear: assignment.academicYear,
            },
          },
        });
      } else {
        studentConditions.push({
          batches: {
            some: {
              id: assignment.batchId as string,
            },
          },
        });
      }

      const studentWhere: Prisma.StudentWhereInput = {
        AND: studentConditions,
      };

      const [total, students] = await Promise.all([
        db.student.count({ where: studentWhere }),
        db.student.findMany({
          where: studentWhere,
          skip,
          take: filters.limit,
          orderBy: [{ usn: "asc" }],
          select: {
            id: true,
            usn: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        }),
      ]);

      const items: FacultyHandlingStudentDTO[] = students.map((student) => ({
        studentId: student.id,
        usn: student.usn,
        name: student.user.name,
        email: student.user.email,
        section: assignment.section.name,
        batchName: assignment.assignmentType === "LAB" ? assignment.batch?.name ?? undefined : undefined,
        semesterNumber: assignment.semester,
      }));

      return {
        status: "success",
        message: "Students for faculty assignment fetched successfully",
        data: buildPaginatedResponse(items, total, filters.page, filters.limit),
      };
    } catch (error) {
      logger.error("Error fetching students by faculty assignment", { error });
      throw error;
    }
  }
}