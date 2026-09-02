import { isBatchManagedCourse } from "@webcampus/api/src/services/shared/course-kind";
import { getOrSet } from "@webcampus/common/cache";
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
  courseId?: string;
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
  isElective?: boolean;
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
    type: "odd" | "even" | "supplementary";
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
    isElectiveBatch?: boolean;
  }[];
  courses: {
    id: string;
    code: string;
    name: string;
    courseType: string;
    semesterId: string;
  }[];
  batches: {
    id: string;
    name: string;
    courseId: string;
    isElective: boolean;
  }[];
};

type NormalizedFilters = {
  search?: string;
  academicTermId?: string;
  programType?: "UG" | "PG";
  semesterId?: string;
  sectionId?: string;
  batchId?: string;
  courseId?: string;
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

const normalizeFilters = (
  filters: FacultyHandlingQueryInput
): NormalizedFilters => {
  const page = toPositiveInteger(filters.page, DEFAULT_PAGE);
  const limit = toPositiveInteger(filters.limit, DEFAULT_LIMIT);

  return {
    search: toTrimmedString(filters.search),
    academicTermId: toTrimmedString(
      filters.academicTermId ?? filters.academicTerm
    ),
    programType: filters.programType,
    semesterId: toTrimmedString(filters.semesterId),
    sectionId: toTrimmedString(filters.sectionId ?? filters.section),
    batchId: toTrimmedString(filters.batchId ?? filters.batch),
    courseId: toTrimmedString(filters.courseId),
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

const buildSectionFilter = (
  sectionId: string
): Prisma.CourseAssignmentWhereInput => {
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

const buildBatchFilter = (
  batchId: string
): Prisma.CourseAssignmentWhereInput => {
  if (isUuid(batchId)) {
    return {
      OR: [
        { batchId },
        { batch: { name: { contains: batchId, mode: "insensitive" } } },
      ],
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

const toStudentSectionCountKey = (
  sectionId: string,
  semester: number,
  academicYear: string
) => `${sectionId}::${semester}::${academicYear}`;

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

  if (filters.courseId) {
    andConditions.push({ courseId: filters.courseId });
  }

  if (filters.academicTermId) {
    andConditions.push({
      course: { semester: { academicTermId: filters.academicTermId } },
    });
  }

  if (filters.programType) {
    andConditions.push({
      course: { semester: { programType: filters.programType } },
    });
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

  if (filters.batchId && assignmentType === "LAB") {
    andConditions.push(buildBatchFilter(filters.batchId));
  }

  if (filters.search) {
    andConditions.push({
      OR: [
        { course: { code: { contains: filters.search, mode: "insensitive" } } },
        { course: { name: { contains: filters.search, mode: "insensitive" } } },
        {
          section: { name: { contains: filters.search, mode: "insensitive" } },
        },
        { batch: { name: { contains: filters.search, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: andConditions };
};

/**
 * Builds the filter where-clause for PE/OE/PW rows (ElectiveBatchFaculty),
 * mirroring the PC filter semantics (contract C2) in the elective domain.
 * Only the batch/group filter applies here: Section filters belong to the
 * CourseAssignment (PC/NCMC) domain only, and must never scope elective/PW
 * rows (contract C3).
 */
const buildElectiveWhere = (
  facultyId: string,
  filters: NormalizedFilters
): Prisma.ElectiveBatchFacultyWhereInput => {
  const courseConditions: Prisma.CourseWhereInput = {};
  const semesterConditions: Prisma.SemesterWhereInput = {};

  if (filters.courseId) {
    courseConditions.id = filters.courseId;
  }

  if (filters.academicTermId) {
    semesterConditions.academicTermId = filters.academicTermId;
  }

  if (filters.programType) {
    semesterConditions.programType = filters.programType;
  }

  if (filters.semesterId) {
    semesterConditions.id = filters.semesterId;
  }

  if (filters.semesterNumber !== undefined) {
    courseConditions.semesterNumber = filters.semesterNumber;
  }

  if (Object.keys(semesterConditions).length > 0) {
    courseConditions.semester = semesterConditions;
  }

  const where: Prisma.ElectiveBatchFacultyWhereInput = {
    facultyId,
    course: { approvalStatus: "APPROVED", ...courseConditions },
  };

  if (filters.batchId) {
    where.electiveBatch = { id: filters.batchId };
  }

  if (filters.academicYear) {
    where.academicYear = filters.academicYear;
  }

  if (filters.search) {
    where.OR = [
      { course: { code: { contains: filters.search, mode: "insensitive" } } },
      { course: { name: { contains: filters.search, mode: "insensitive" } } },
      {
        electiveBatch: {
          name: { contains: filters.search, mode: "insensitive" },
        },
      },
    ];
  }

  return where;
};

type OwnedApprovedElectiveAssignment = {
  id: string;
  facultyId: string;
  semester: number;
  academicYear: string;
  electiveBatch: {
    id: string;
    name: string;
  };
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
      throw new Error(
        "Forbidden: assignment does not belong to current faculty"
      );
    }

    if (assignment.assignmentType !== assignmentType) {
      throw new Error("Forbidden: assignment type mismatch for this endpoint");
    }

    if (assignment.course.approvalStatus !== "APPROVED") {
      throw new Error("Assignment course is not approved");
    }

    return assignment;
  }

  private static async getOwnedApprovedElectiveAssignment(
    facultyId: string,
    assignmentId: string
  ): Promise<OwnedApprovedElectiveAssignment | null> {
    const assignment = await db.electiveBatchFaculty.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        facultyId: true,
        semester: true,
        academicYear: true,
        electiveBatch: {
          select: {
            id: true,
            name: true,
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            semesterId: true,
            semesterNumber: true,
            semester: {
              select: {
                id: true,
                academicTermId: true,
                programType: true,
              },
            },
            approvalStatus: true,
          },
        },
      },
    });

    if (!assignment) {
      return null;
    }

    if (assignment.facultyId !== facultyId) {
      throw new Error(
        "Forbidden: assignment does not belong to current faculty"
      );
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
      const facultyId =
        await FacultyHandlingService.getFacultyIdByUserId(userId);
      const filters = normalizeFilters(query);
      const where = buildAssignmentWhere(facultyId, assignmentType, filters);
      const skip = (filters.page - 1) * filters.limit;
      const electiveWhere =
        assignmentType === "THEORY"
          ? buildElectiveWhere(facultyId, filters)
          : undefined;

      const [totalPc, assignments, totalElective, batchFacultyRows] =
        await Promise.all([
          db.courseAssignment.count({ where }),
          db.courseAssignment.findMany({
            where,
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
                  semesterId: true,
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
          assignmentType === "THEORY"
            ? db.electiveBatchFaculty.count({ where: electiveWhere })
            : Promise.resolve(0),
          assignmentType === "THEORY"
            ? db.electiveBatchFaculty.findMany({
                where: electiveWhere,
                select: {
                  id: true,
                  semester: true,
                  academicYear: true,
                  electiveBatch: {
                    select: {
                      id: true,
                      name: true,
                      _count: {
                        select: { studentAssignments: true },
                      },
                    },
                  },
                  course: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      semesterId: true,
                      semesterNumber: true,
                      semester: {
                        select: {
                          academicTermId: true,
                          programType: true,
                        },
                      },
                    },
                  },
                },
              })
            : Promise.resolve([]),
        ]);

      const batchAsAssignments = batchFacultyRows.map((row) => ({
        id: row.id,
        assignmentType: "THEORY" as const,
        semester: row.semester,
        academicYear: row.academicYear,
        section: {
          id: row.electiveBatch.id,
          name: row.electiveBatch.name,
          semesterId: row.course.semesterId,
        },
        course: row.course,
        batch: {
          id: row.electiveBatch.id,
          name: row.electiveBatch.name,
          _count: { students: row.electiveBatch._count.studentAssignments },
        },
      }));

      const total = totalPc + totalElective;
      // Contract C2: merge both filtered sources, apply a shared sort,
      // then apply the global pagination slice AFTER the merge.
      const merged = [...batchAsAssignments, ...assignments]
        .sort(
          (a, b) =>
            b.semester - a.semester ||
            String(b.academicYear ?? "").localeCompare(
              String(a.academicYear ?? "")
            ) ||
            a.course.code.localeCompare(b.course.code)
        )
        .slice(skip, skip + filters.limit);

      const theoryFilters = Array.from(
        new Map(
          assignments
            .filter((assignment) => assignment.assignmentType === "THEORY")
            .map((assignment) => {
              const key = toStudentSectionCountKey(
                assignment.section.id,
                assignment.semester,
                assignment.academicYear
              );

              return [
                key,
                {
                  key,
                  courseId: assignment.course.id,
                  courseSemesterId: assignment.course.semesterId,
                  courseAcademicTermId:
                    assignment.course.semester.academicTermId,
                  sectionId: assignment.section.id,
                  semester: assignment.semester,
                  academicYear: assignment.academicYear,
                },
              ] as const;
            })
        ).values()
      );

      const theoryCountByKey = new Map<string, number>();
      if (theoryFilters.length > 0) {
        const theoryCourseIds = [
          ...new Set(theoryFilters.map((f) => f.courseId)),
        ];

        const registrations = await db.courseRegistration.findMany({
          where: { courseId: { in: theoryCourseIds } },
          select: { courseId: true, studentId: true },
        });

        const regStudentIds = [
          ...new Set(registrations.map((r) => r.studentId)),
        ];

        const studentSections = await db.studentSection.findMany({
          where: {
            studentId: { in: regStudentIds },
            OR: theoryFilters.map((f) => ({
              sectionId: f.sectionId,
              semester: f.semester,
              academicYear: f.academicYear,
            })),
          },
          select: {
            studentId: true,
            sectionId: true,
            semester: true,
            academicYear: true,
          },
        });

        const studentSectionMap = new Map<string, Set<string>>();
        for (const ss of studentSections) {
          const key = toStudentSectionCountKey(
            ss.sectionId,
            ss.semester,
            ss.academicYear
          );
          const set = studentSectionMap.get(ss.studentId) ?? new Set();
          set.add(key);
          studentSectionMap.set(ss.studentId, set);
        }

        for (const reg of registrations) {
          const sectionKeys = studentSectionMap.get(reg.studentId);
          if (sectionKeys) {
            for (const key of sectionKeys) {
              const match = theoryFilters.find(
                (f) => f.key === key && f.courseId === reg.courseId
              );
              if (match) {
                theoryCountByKey.set(key, (theoryCountByKey.get(key) ?? 0) + 1);
              }
            }
          }
        }
      }

      const items: FacultyHandlingAssignmentDTO[] = merged.map((assignment) => {
        const isPeElectiveBatch =
          assignment.batch?.id === assignment.section.id &&
          assignment.batch?.name === assignment.section.name;

        const studentCount = isPeElectiveBatch
          ? (assignment.batch?._count.students ?? 0)
          : assignment.assignmentType === "THEORY"
            ? (theoryCountByKey.get(
                toStudentSectionCountKey(
                  assignment.section.id,
                  assignment.semester,
                  assignment.academicYear
                )
              ) ?? 0)
            : (assignment.batch?._count.students ?? 0);

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
          isElective: isPeElectiveBatch,
        };
      });

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
      return await getOrSet(
        `cache:handling-filters:${userId}:${assignmentType}`,
        900,
        async () => {
          const facultyId =
            await FacultyHandlingService.getFacultyIdByUserId(userId);

          const dbTerms = await db.academicTerm.findMany();

          const dbSemesters = await db.semester.findMany({
            select: {
              id: true,
              academicTermId: true,
              programType: true,
              semesterNumber: true,
            },
          });

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
              batch: {
                select: {
                  id: true,
                  name: true,
                },
              },
              course: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  courseType: true,
                  semesterId: true,
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

          const electiveBatchFacultyRows = await (assignmentType === "THEORY"
            ? db.electiveBatchFaculty.findMany({
                where: {
                  facultyId,
                  course: {
                    approvalStatus: "APPROVED",
                  },
                },
                select: {
                  course: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      courseType: true,
                      semesterId: true,
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
                  electiveBatch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              })
            : Promise.resolve([]));

          const batchManagedRows = electiveBatchFacultyRows.filter((row) =>
            isBatchManagedCourse(row.course.courseType)
          );

          const semesterMap = new Map<
            string,
            {
              id: string;
              academicTermId: string;
              programType: "UG" | "PG";
              semesterNumber: number;
            }
          >();
          const sectionMap = new Map<
            string,
            {
              id: string;
              name: string;
              semesterId: string;
              isElectiveBatch: boolean;
            }
          >();
          const courseMap = new Map<
            string,
            {
              id: string;
              code: string;
              name: string;
              courseType: string;
              semesterId: string;
            }
          >();
          const batchMap = new Map<
            string,
            { id: string; name: string; courseId: string; isElective: boolean }
          >();

          for (const semester of dbSemesters) {
            semesterMap.set(semester.id, {
              id: semester.id,
              academicTermId: semester.academicTermId,
              programType: semester.programType,
              semesterNumber: semester.semesterNumber,
            });
          }

          for (const assignment of assignments) {
            sectionMap.set(assignment.section.id, {
              id: assignment.section.id,
              name: assignment.section.name,
              semesterId: assignment.section.semesterId,
              isElectiveBatch: false,
            });

            courseMap.set(assignment.course.id, {
              id: assignment.course.id,
              code: assignment.course.code,
              name: assignment.course.name,
              courseType: assignment.course.courseType,
              semesterId: assignment.course.semesterId,
            });

            if (assignment.batch) {
              batchMap.set(assignment.batch.id, {
                id: assignment.batch.id,
                name: assignment.batch.name,
                courseId: assignment.course.id,
                isElective: false,
              });
            }
          }

          for (const row of batchManagedRows) {
            const semester = row.course.semester;

            sectionMap.set(row.electiveBatch.id, {
              id: row.electiveBatch.id,
              name: row.electiveBatch.name,
              semesterId: semester.id,
              isElectiveBatch: true,
            });

            courseMap.set(row.course.id, {
              id: row.course.id,
              code: row.course.code,
              name: row.course.name,
              courseType: row.course.courseType,
              semesterId: row.course.semesterId,
            });

            batchMap.set(row.electiveBatch.id, {
              id: row.electiveBatch.id,
              name: row.electiveBatch.name,
              courseId: row.course.id,
              isElective: true,
            });
          }

          const academicTerms = dbTerms
            .map((term) => ({
              id: term.id,
              year: term.year,
              type: term.type,
            }))
            .sort((a, b) => {
              const yearComparison = b.year.localeCompare(a.year, undefined, {
                numeric: true,
                sensitivity: "base",
              });

              if (yearComparison !== 0) {
                return yearComparison;
              }

              const termPriority: Record<
                "odd" | "even" | "supplementary",
                number
              > = {
                odd: 0,
                even: 1,
                supplementary: 2,
              };

              return termPriority[a.type] - termPriority[b.type];
            });

          const termOrder = new Map(
            academicTerms.map((term, index) => [term.id, index])
          );

          const semesters = Array.from(semesterMap.values()).sort((a, b) => {
            const aTermOrder =
              termOrder.get(a.academicTermId) ?? Number.MAX_SAFE_INTEGER;
            const bTermOrder =
              termOrder.get(b.academicTermId) ?? Number.MAX_SAFE_INTEGER;

            if (aTermOrder !== bTermOrder) {
              return aTermOrder - bTermOrder;
            }

            const programTypePriority: Record<"UG" | "PG", number> = {
              UG: 0,
              PG: 1,
            };

            if (a.programType !== b.programType) {
              return (
                programTypePriority[a.programType] -
                programTypePriority[b.programType]
              );
            }

            return a.semesterNumber - b.semesterNumber;
          });

          const sections = Array.from(sectionMap.values()).sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          });

          const courses = Array.from(courseMap.values()).sort((a, b) => {
            return a.code.localeCompare(b.code, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          });

          const batches = Array.from(batchMap.values()).sort((a, b) => {
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
              courses,
              batches,
            },
          };
        }
      );
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
      const facultyId =
        await FacultyHandlingService.getFacultyIdByUserId(userId);

      const electiveAssignment =
        await FacultyHandlingService.getOwnedApprovedElectiveAssignment(
          facultyId,
          assignmentId
        );

      let assignment: OwnedApprovedAssignment & {
        electiveBatchId?: string;
      };
      let isElectiveAssignment = false;

      if (electiveAssignment) {
        isElectiveAssignment = true;
        assignment = {
          id: electiveAssignment.id,
          facultyId: electiveAssignment.facultyId,
          assignmentType: "THEORY",
          semester: electiveAssignment.semester,
          academicYear: electiveAssignment.academicYear,
          sectionId: electiveAssignment.electiveBatch.id,
          electiveBatchId: electiveAssignment.electiveBatch.id,
          batchId: null,
          course: electiveAssignment.course,
          section: {
            id: electiveAssignment.electiveBatch.id,
            name: electiveAssignment.electiveBatch.name,
            semesterId: electiveAssignment.course.semesterId,
          },
          batch: null,
        };
      } else {
        assignment = await FacultyHandlingService.getOwnedApprovedAssignment(
          facultyId,
          assignmentId,
          assignmentType
        );
      }

      if (assignment.assignmentType === "LAB" && !assignment.batchId) {
        throw new Error("Invalid assignment: LAB assignment must have a batch");
      }

      const filters = normalizeFilters(query);

      if (
        filters.academicTermId &&
        assignment.course.semester.academicTermId !== filters.academicTermId
      ) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (
        filters.programType &&
        assignment.course.semester.programType !== filters.programType
      ) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (
        filters.semesterId &&
        assignment.course.semesterId !== filters.semesterId
      ) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (
        filters.semesterNumber !== undefined &&
        assignment.semester !== filters.semesterNumber
      ) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (
        filters.academicYear &&
        assignment.academicYear !== filters.academicYear
      ) {
        throw new Error("Assignment not found for the provided filters");
      }

      if (
        filters.sectionId &&
        !matchesIdentifierOrName(assignment.section, filters.sectionId)
      ) {
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
            {
              user: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              user: {
                email: { contains: search, mode: "insensitive" as const },
              },
            },
          ],
        });
      }

      if (isElectiveAssignment) {
        studentConditions.push({
          electiveStudentAssignments: {
            some: {
              courseId: assignment.course.id,
              electiveBatchId: assignment.electiveBatchId as string,
            },
          },
        });
      } else if (assignment.assignmentType === "THEORY") {
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

      studentConditions.push({
        registrations: {
          some: {
            courseId: assignment.course.id,
            status: "ACTIVE",
            registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
          },
        },
      });

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
        batchName:
          assignment.assignmentType === "LAB"
            ? (assignment.batch?.name ?? undefined)
            : undefined,
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
