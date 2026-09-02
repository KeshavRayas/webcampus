import {
  checkAndIncrementElectiveMappingVersion,
  logChanges,
} from "@webcampus/api/src/services/shared/audit.service";
import { DepartmentContextResolver } from "@webcampus/api/src/services/shared/department-context-resolver.service";
import { assertFacultyReassignmentAllowed } from "@webcampus/api/src/services/shared/faculty-distribution";
import { PeCapacityService } from "@webcampus/api/src/services/shared/pe-capacity.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import type { Cycle } from "@webcampus/db";
import type {
  ProjectFacultyAssignmentInput,
  ProjectMappingBulkAssign,
  ProjectMappingExcelError,
  ProjectMappingSave,
  ProjectMappingSaveFaculty,
  ProjectStudentAssignmentInput,
} from "@webcampus/schemas/department";
import type { BaseResponse } from "@webcampus/types/api";
import ExcelJS from "exceljs";

type TxClient = Prisma.TransactionClient | typeof db;

/**
 * Hard safety limit on worksheet data rows (excluding the metadata/header rows).
 * A defensive parser limit, not a business limitation. Exceeding it rejects the
 * upload with EXCEEDS_ROW_LIMIT, with no partial processing and no DB writes.
 */
const MAX_EXCEL_DATA_ROWS = 10000;

/**
 * Raised when an uploaded project-mapping Excel file fails validation. Carries
 * one structured error per problem so the UI can render row-level diagnostics.
 */
export class ProjectMappingExcelValidationError extends Error {
  constructor(public readonly errors: ProjectMappingExcelError[]) {
    super("Excel validation failed");
    this.name = "ProjectMappingExcelValidationError";
  }
}

type MappingContext = {
  departmentId?: string;
  departmentName?: string;
  requesterRole?: "admin" | "department";
  adminUserId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Zero-padded project-group display name, e.g. G-001 … G-999.
 */
function projectGroupName(sequence: number): string {
  return `G-${String(sequence).padStart(3, "0")}`;
}

/**
 * Resolve the student's section relevant to a course. Students can hold
 * multiple StudentSection rows across semesters, so prefer the row whose
 * section belongs to the student's current semester; fall back to the first
 * row only when no semester-scoped match exists.
 */
function resolveStudentSection<
  S extends { id: string; semesterId?: string | null },
>(student: {
  semesterId?: string | null;
  studentSections: Array<{ section: S }>;
}): S | null {
  const sections = student.studentSections ?? [];
  if (sections.length === 0) return null;
  if (student.semesterId) {
    const scoped = sections.find(
      (item) => item.section.semesterId === student.semesterId
    );
    if (scoped) return scoped.section;
  }
  return sections[0]?.section ?? null;
}

type SyncProjectGroupsParams = {
  tx: TxClient;
  courseId: string;
  studentsPerGroup: number;
  groupingScope: "WITHIN_SECTION" | "DEPARTMENT_WIDE";
  /**
   * Configured group count for DEPARTMENT_WIDE. Ignored (derived per section)
   * when groupingScope is WITHIN_SECTION.
   */
  targetGroupCount: number | null;
};

/**
 * Service backing the Project / Mini-Project (PW) workflow.
 *
 * PW courses are stored in the shared batch-managed storage
 * (ElectiveBatch / ElectiveBatchFaculty / ElectiveStudentAssignment) so all
 * downstream consumers (attendance, marks, freeze, reports, handling) flow
 * through unchanged. PW differs from PE/OE in group lifecycle:
 *
 * - Group identity is IMMUTABLE once created: groups are never renamed or
 *   renumbered, and previously-used identifiers are never reused.
 * - Group count is derived per section for WITHIN_SECTION (ceil(section
 *   students ÷ students per group), min 1 per section) or configured for
 *   DEPARTMENT_WIDE.
 */
export class ProjectMappingService {
  /**
   * Reconcile the course's project groups against its configuration.
   *
   * - WITHIN_SECTION: one group bucket per section of the course's
   *   semester/department (cycle-aware). New groups are bound to their
   *   section via ElectiveBatch.sectionId.
   * - DEPARTMENT_WIDE: a single bucket (sectionId null) sized by the
   *   configured numberOfGroups.
   *
   * Removal only ever deletes groups that are empty (no student
   * assignments), unmapped (no faculty) and without attendance/marks history.
   * When the grouping scope changes, groups that no longer belong to any
   * bucket (orphans) must be removable, otherwise the change is rejected.
   */
  static async syncProjectGroups(
    params: SyncProjectGroupsParams
  ): Promise<void> {
    const { tx, courseId, studentsPerGroup, groupingScope } = params;

    const course = await tx.course.findUnique({
      where: { id: courseId },
      include: {
        semester: { include: { academicTerm: true } },
      },
    });
    if (!course) {
      throw new Error("Course not found");
    }

    // Serialize concurrent reconciles of the same PW course on the Course row,
    // reusing the SELECT ... FOR UPDATE pattern from peRegistrationStrategy
    // (registration-strategies.ts). Course ids are sorted by callers before
    // locking to avoid cross-course deadlock. The lock MUST be taken before
    // reading existing batches / computing nextSequence so that sequence and
    // existence checks observe the latest committed state.
    await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`;

    const existing = await tx.electiveBatch.findMany({
      where: { courseId },
      include: {
        _count: {
          select: {
            studentAssignments: true,
            attendances: true,
            attendanceRecords: true,
            classSessions: true,
          },
        },
        facultyAssignment: { select: { id: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Compute the desired per-bucket group count (shared derivation, reused by
    // the course-configuration capacity guard in course.service.ts so the two
    // can never drift).
    const desiredBuckets = await ProjectMappingService.computeDesiredBuckets({
      tx,
      studentsPerGroup,
      groupingScope,
      targetGroupCount: params.targetGroupCount ?? null,
      scope: {
        semesterId: course.semesterId,
        semesterNumber: course.semesterNumber,
        academicYear: course.semester?.academicTerm?.year ?? "",
        departmentId: course.departmentId,
        cycle: course.cycle ?? null,
      },
    });

    const isRemovable = (batch: (typeof existing)[number]) =>
      batch._count.studentAssignments === 0 &&
      batch._count.attendances === 0 &&
      batch._count.attendanceRecords === 0 &&
      batch._count.classSessions === 0 &&
      batch.facultyAssignment === null;

    const bucketKey = (sectionId: string | null) => sectionId ?? "__dept__";

    // Bucket existing groups by sectionId; collect orphans (groups whose
    // sectionId matches no desired bucket — e.g. after a scope change or a
    // section removal).
    const byBucket = new Map<string, typeof existing>();
    const orphans: typeof existing = [];
    for (const batch of existing) {
      if (desiredBuckets.some((b) => b.sectionId === batch.sectionId)) {
        const key = bucketKey(batch.sectionId);
        const list = byBucket.get(key) ?? [];
        list.push(batch);
        byBucket.set(key, list);
      } else {
        orphans.push(batch);
      }
    }

    let structuralChange = false;
    // Immutable sequence: start from the course's persisted counter, never
    // below the highest existing sortOrder.
    let nextSequence = Math.max(
      course.nextProjectGroupSequence,
      existing.length ? Math.max(...existing.map((b) => b.sortOrder)) : 0
    );

    // Orphans must be removable, otherwise the scope/config change is unsafe.
    if (orphans.length > 0) {
      const removableOrphans = orphans.filter(isRemovable);
      if (removableOrphans.length !== orphans.length) {
        throw new Error(
          "Cannot change grouping configuration while project groups have students, faculty, or attendance/marks history."
        );
      }
      structuralChange = true;
      await removeBatches(
        tx,
        courseId,
        removableOrphans.map((b) => b.id)
      );
    }

    let finalTotal = 0;
    for (const bucket of desiredBuckets) {
      const key = bucketKey(bucket.sectionId);
      const bucketGroups = byBucket.get(key) ?? [];
      finalTotal += bucket.count;

      if (bucketGroups.length < bucket.count) {
        structuralChange = true;
        for (let i = 0; i < bucket.count - bucketGroups.length; i++) {
          nextSequence += 1;
          await tx.electiveBatch.create({
            data: {
              courseId,
              name: projectGroupName(nextSequence),
              sortOrder: nextSequence,
              sectionId: bucket.sectionId,
            },
          });
        }
      } else if (bucketGroups.length > bucket.count) {
        const excess = bucketGroups.length - bucket.count;
        const removable = bucketGroups
          .filter(isRemovable)
          .sort((a, b) => b.sortOrder - a.sortOrder);
        if (removable.length < excess) {
          throw new Error(
            `Cannot reduce project groups: ${bucket.count} target but only ${bucketGroups.length - removable.length} groups can be removed (groups with students, faculty, or attendance/marks history must remain).`
          );
        }
        structuralChange = true;
        await removeBatches(
          tx,
          courseId,
          removable.slice(0, excess).map((b) => b.id)
        );
      }
    }

    await tx.course.update({
      where: { id: courseId },
      data: {
        numberOfBatches: finalTotal,
        nextProjectGroupSequence: nextSequence,
        ...(structuralChange
          ? { electiveMappingVersion: { increment: 1 } }
          : {}),
      },
    });
  }

  /**
   * Reconcile project groups for every PW course in a department/semester
   * scope. Invoked from the Section/StudentSection lifecycle mutations (all
   * inside the SAME transaction as the mutation). Only courses with
   * courseType "PW" are touched; PE/OE/PC/NCMC are never reconciled.
   *
   * The per-course group derivation is delegated entirely to syncProjectGroups
   * (which reuses computeDesiredBuckets), so there is no separate/duplicated
   * group-counting logic and no drift between the two paths.
   *
   * Course ids are sorted before processing; syncProjectGroups takes a
   * SELECT ... FOR UPDATE lock on each Course row, so concurrent reconciles of
   * the same course serialize deterministically.
   */
  static async reconcileProjectGroupsForScope(params: {
    tx: TxClient;
    departmentId: string;
    semesterId: string;
  }): Promise<void> {
    const { tx, departmentId, semesterId } = params;

    const pwCourses = await tx.course.findMany({
      where: {
        courseType: "PW",
        departmentId,
        semesterId,
      },
      select: {
        id: true,
        studentsPerBatch: true,
        projectGroupingScope: true,
        numberOfBatches: true,
      },
    });

    const sortedCourseIds = pwCourses
      .map((c) => c.id)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    for (const courseId of sortedCourseIds) {
      const course = pwCourses.find((c) => c.id === courseId);
      if (!course) {
        continue;
      }
      await ProjectMappingService.syncProjectGroups({
        tx,
        courseId,
        studentsPerGroup: course.studentsPerBatch ?? 1,
        groupingScope: course.projectGroupingScope,
        targetGroupCount: course.numberOfBatches ?? null,
      });
    }
  }

  /**
   * Derive the desired per-bucket project-group counts for a PW course.
   *
   * Shared between syncProjectGroups (which reconciles the actual ElectiveBatch
   * rows) and the course-configuration capacity guard (course.service.ts) so the
   * two can never drift:
   *
   * - WITHIN_SECTION: one bucket per section of the course's semester/department
   *   (cycle-aware), sized `max(1, ceil(section population / studentsPerGroup))`.
   * - DEPARTMENT_WIDE: a single bucket (sectionId null) sized by
   *   `targetGroupCount`.
   */
  static async computeDesiredBuckets(params: {
    tx: TxClient;
    studentsPerGroup: number;
    groupingScope: "WITHIN_SECTION" | "DEPARTMENT_WIDE";
    targetGroupCount: number | null;
    scope: {
      semesterId: string;
      semesterNumber: number;
      academicYear: string;
      departmentId: string;
      cycle: Cycle | null;
    };
  }): Promise<Array<{ sectionId: string | null; count: number }>> {
    const { tx, studentsPerGroup, groupingScope, targetGroupCount, scope } =
      params;
    const desiredBuckets: Array<{ sectionId: string | null; count: number }> =
      [];

    if (groupingScope === "WITHIN_SECTION") {
      const sections = await tx.section.findMany({
        where: {
          semesterId: scope.semesterId,
          departmentId: scope.departmentId,
          ...(scope.cycle && scope.cycle !== "NONE"
            ? { cycle: scope.cycle }
            : {}),
        },
        orderBy: { name: "asc" },
      });

      for (const section of sections) {
        const population = await tx.studentSection.count({
          where: {
            sectionId: section.id,
            semester: scope.semesterNumber,
            academicYear: scope.academicYear,
          },
        });
        desiredBuckets.push({
          sectionId: section.id,
          count: Math.max(1, Math.ceil(population / studentsPerGroup)),
        });
      }
    } else {
      desiredBuckets.push({
        sectionId: null,
        count: targetGroupCount ?? 0,
      });
    }

    return desiredBuckets;
  }

  /**
   * Effective total group count for a PW course = sum of per-bucket counts.
   *
   * Used by the course-configuration capacity guard (course.service.ts) to
   * compute scope-aware capacity (effectiveGroupCount × studentsPerGroup) so a
   * configuration change that would strand registered students is rejected.
   * Accepts scope overrides so it can be evaluated against the TARGET scope
   * during an update before the transaction commits.
   */
  static async computeEffectiveGroupCount(params: {
    tx: TxClient;
    courseId: string;
    studentsPerGroup: number;
    groupingScope: "WITHIN_SECTION" | "DEPARTMENT_WIDE";
    targetGroupCount: number | null;
    scope?: {
      semesterId?: string;
      semesterNumber?: number;
      academicYear?: string;
      departmentId?: string;
      cycle?: Cycle | null;
    };
  }): Promise<number> {
    const { tx, courseId, studentsPerGroup, groupingScope, targetGroupCount } =
      params;

    const course = await tx.course.findUnique({
      where: { id: courseId },
      include: {
        semester: { include: { academicTerm: true } },
      },
    });
    if (!course) {
      throw new Error("Course not found");
    }

    const scope = {
      semesterId: params.scope?.semesterId ?? course.semesterId,
      semesterNumber: params.scope?.semesterNumber ?? course.semesterNumber,
      academicYear:
        params.scope?.academicYear ?? course.semester?.academicTerm?.year ?? "",
      departmentId: params.scope?.departmentId ?? course.departmentId,
      cycle: params.scope?.cycle ?? course.cycle ?? null,
    };

    const buckets = await ProjectMappingService.computeDesiredBuckets({
      tx,
      studentsPerGroup,
      groupingScope,
      targetGroupCount,
      scope,
    });

    return buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  }

  private static async resolveDepartment(
    requestingUserId: string,
    context?: MappingContext
  ): Promise<{ id: string; name: string }> {
    if (context?.requesterRole === "admin") {
      if (!context.departmentId && !context.departmentName) {
        throw new Error("departmentId is required");
      }
      const resolved = await DepartmentContextResolver.resolve({
        source: "project-mapping",
        departmentId: context.departmentId,
        departmentName: context.departmentName,
      });
      const department = await db.department.findUnique({
        where: { id: resolved.departmentId },
        select: { id: true, name: true },
      });
      if (!department) {
        throw new Error("Department not found");
      }
      return department;
    }

    const department = await db.department.findFirst({
      where: { userId: requestingUserId },
      select: { id: true, name: true },
    });
    if (!department) {
      throw new Error("Requesting department not found");
    }
    return department;
  }

  static async listCourses(
    semesterId: string,
    requestingUserId: string,
    cycle: string | undefined,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const courses = await db.course.findMany({
        where: {
          semesterId,
          departmentId: department.id,
          courseType: "PW",
          ...(cycle ? { cycle: cycle as never } : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          projectGroupingScope: true,
          numberOfBatches: true,
          studentsPerBatch: true,
          electiveMappingVersion: true,
          electiveBatches: {
            select: { id: true, facultyAssignment: { select: { id: true } } },
          },
          _count: {
            select: {
              registrations: {
                where: {
                  status: "ACTIVE",
                  registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
                },
              },
              electiveStudentAssignments: true,
            },
          },
        },
        orderBy: { code: "asc" },
      });

      const data = courses.map((course) => {
        const groupCount = course.electiveBatches.length;
        const facultyMappedCount = course.electiveBatches.filter(
          (b) => b.facultyAssignment
        ).length;
        const facultyMappingComplete =
          groupCount > 0 && facultyMappedCount === groupCount;
        const electiveMappingComplete =
          course._count.registrations === 0 ||
          course._count.electiveStudentAssignments >=
            course._count.registrations;
        return {
          id: course.id,
          code: course.code,
          name: course.name,
          courseType: "PW",
          projectGroupingScope: course.projectGroupingScope,
          numberOfGroups: groupCount,
          studentsPerGroup: course.studentsPerBatch,
          registeredCount: course._count.registrations,
          electiveAssignedCount: course._count.electiveStudentAssignments,
          facultyMappedCount,
          facultyMappingComplete,
          electiveMappingComplete,
          electiveMappingVersion: course.electiveMappingVersion,
        };
      });

      return { status: "success", message: "Project courses fetched", data };
    } catch (error) {
      logger.error("ProjectMappingService.listCourses failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to list project courses");
    }
  }

  private static async getPwCourse(
    courseId: string,
    departmentId: string
  ): Promise<{
    id: string;
    code: string;
    name: string;
    projectGroupingScope: string;
    numberOfBatches: number | null;
    studentsPerBatch: number | null;
    electiveMappingVersion: number;
    semesterId: string;
    semesterNumber: number;
    cycle: string;
    departmentName: string | null;
    semester: { academicTerm: { year: string } };
  } | null> {
    return db.course.findFirst({
      where: { id: courseId, departmentId, courseType: "PW" },
      select: {
        id: true,
        code: true,
        name: true,
        projectGroupingScope: true,
        numberOfBatches: true,
        studentsPerBatch: true,
        electiveMappingVersion: true,
        semesterId: true,
        semesterNumber: true,
        cycle: true,
        departmentName: true,
        semester: { select: { academicTerm: { select: { year: true } } } },
      },
    });
  }

  private static async loadStudentContext(
    courseId: string,
    tx: TxClient = db
  ): Promise<{
    registrations: Array<{
      studentId: string;
      student: {
        id: string;
        usn: string;
        departmentName: string;
        semesterId: string | null;
        studentSections: Array<{
          section: {
            id: string;
            name: string;
            cycle: string;
            semesterId: string | null;
          };
        }>;
      };
    }>;
    registeredIds: Set<string>;
    batches: Array<{ id: string; sectionId: string | null }>;
    batchMap: Map<string, { id: string; sectionId: string | null }>;
  }> {
    const registrations = await tx.courseRegistration.findMany({
      where: { courseId },
      select: {
        studentId: true,
        student: {
          select: {
            id: true,
            usn: true,
            departmentName: true,
            semesterId: true,
            studentSections: {
              select: {
                section: {
                  select: {
                    id: true,
                    name: true,
                    cycle: true,
                    semesterId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const registeredIds = new Set(registrations.map((r) => r.studentId));
    const batches = await tx.electiveBatch.findMany({
      where: { courseId },
      select: { id: true, sectionId: true },
    });
    const batchMap = new Map(batches.map((b) => [b.id, b]));
    return { registrations, registeredIds, batches, batchMap };
  }

  private static validateStudentAssignments(
    course: { projectGroupingScope: string; studentsPerBatch: number | null },
    assignments: ProjectStudentAssignmentInput[],
    registrations: Array<{
      studentId: string;
      student: {
        usn: string;
        semesterId: string | null;
        studentSections: Array<{
          section: { id: string; semesterId: string | null };
        }>;
      };
    }>,
    registeredIds: Set<string>,
    batchMap: Map<string, { id: string; sectionId: string | null }>
  ): void {
    if (assignments.length !== registeredIds.size) {
      throw new Error(
        "Every registered student must be assigned to a group before saving"
      );
    }
    const registrationsByStudent = new Map(
      registrations.map((reg) => [reg.studentId, reg])
    );
    const assignedStudents = new Set<string>();
    const capacityCounts = new Map<string, number>();
    const wrongSectionUsns: string[] = [];
    for (const row of assignments) {
      if (!registeredIds.has(row.studentId)) {
        throw new Error(
          "Assignment includes a student not registered for this PW course"
        );
      }
      if (!batchMap.has(row.electiveBatchId)) {
        throw new Error("Assignment includes an invalid project group");
      }
      if (assignedStudents.has(row.studentId)) {
        throw new Error("Duplicate student in project mapping payload");
      }
      assignedStudents.add(row.studentId);

      const reg = registrationsByStudent.get(row.studentId)!;
      const section = resolveStudentSection(reg.student);
      const batch = batchMap.get(row.electiveBatchId)!;

      if (course.projectGroupingScope === "WITHIN_SECTION") {
        if (!section || !batch.sectionId || section.id !== batch.sectionId) {
          wrongSectionUsns.push(reg.student.usn);
        }
      }

      const current = capacityCounts.get(row.electiveBatchId) ?? 0;
      capacityCounts.set(row.electiveBatchId, current + 1);
      if (course.studentsPerBatch && current + 1 > course.studentsPerBatch) {
        throw new Error(
          `Group ${batchMap.get(row.electiveBatchId)?.id ?? ""} exceeds the students-per-group limit of ${course.studentsPerBatch}`
        );
      }
    }

    // Report every violating row at once so users fixing an inverted draft do
    // not have to rediscover the next offender on each save attempt.
    if (wrongSectionUsns.length > 0) {
      const preview = wrongSectionUsns.slice(0, 10).join(", ");
      const more =
        wrongSectionUsns.length > 10
          ? ` (+${wrongSectionUsns.length - 10} more)`
          : "";
      throw new Error(
        `${wrongSectionUsns.length} student(s) cannot be placed in a group outside their section: ${preview}${more}`
      );
    }
  }

  private static async assertStudentMovesAllowed(
    courseId: string,
    assignments: ProjectStudentAssignmentInput[],
    tx: TxClient = db
  ): Promise<void> {
    const hasAttendanceOrMarks =
      await PeCapacityService.hasAttendanceOrMarksForCourse(courseId, tx);
    if (!hasAttendanceOrMarks) {
      return;
    }
    const existing = await tx.electiveStudentAssignment.findMany({
      where: { courseId },
      select: { studentId: true, electiveBatchId: true },
    });
    const existingByStudent = new Map(
      existing.map((e) => [e.studentId, e.electiveBatchId])
    );
    for (const row of assignments) {
      const prev = existingByStudent.get(row.studentId);
      if (prev && prev !== row.electiveBatchId) {
        throw new Error(
          "Cannot move already-mapped students after attendance or marks exist"
        );
      }
    }
  }

  private static async validateFacultyAssignments(
    courseId: string,
    rows: ProjectFacultyAssignmentInput[],
    tx: TxClient = db
  ): Promise<Map<string, string>> {
    const batchIds = new Set(rows.map((a) => a.electiveBatchId));
    if (batchIds.size > 0) {
      const batchCount = await tx.electiveBatch.count({
        where: { id: { in: Array.from(batchIds) }, courseId },
      });
      if (batchCount !== batchIds.size) {
        throw new Error(
          "One or more project groups do not belong to this course"
        );
      }
    }

    const facultyIds = Array.from(
      new Set(
        rows.map((a) => a.facultyId).filter((f): f is string => f !== null)
      )
    );
    const facultyById = new Map<string, string>();
    if (facultyIds.length > 0) {
      // Project groups may be guided by faculty from any department, so only
      // existence is validated here (no department ownership check).
      const facultyRecords = await tx.faculty.findMany({
        where: { id: { in: facultyIds } },
        select: { id: true, departmentId: true },
      });
      if (facultyRecords.length !== facultyIds.length) {
        throw new Error("One or more faculty records are invalid");
      }
      for (const record of facultyRecords) {
        facultyById.set(record.id, record.departmentId);
      }
    }

    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.electiveBatchId)) {
        throw new Error("Duplicate project group in faculty mapping payload");
      }
      seen.add(row.electiveBatchId);
    }

    return facultyById;
  }

  static async getCourseDetail(
    courseId: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }

      const batches = await db.electiveBatch.findMany({
        where: { courseId },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          sectionId: true,
          _count: { select: { studentAssignments: true } },
          facultyAssignment: {
            select: {
              facultyId: true,
              faculty: {
                select: { shortName: true, user: { select: { name: true } } },
              },
            },
          },
        },
      });

      const registrations = await db.courseRegistration.findMany({
        where: { courseId },
        select: {
          studentId: true,
          student: {
            select: {
              id: true,
              usn: true,
              user: { select: { name: true } },
              semesterId: true,
              studentSections: {
                select: {
                  section: {
                    select: { id: true, name: true, semesterId: true },
                  },
                },
              },
            },
          },
        },
      });

      const assignments = await db.electiveStudentAssignment.findMany({
        where: { courseId },
        select: { studentId: true, electiveBatchId: true },
      });
      const assignmentByStudent = new Map(
        assignments.map((a) => [a.studentId, a.electiveBatchId])
      );

      const hasAttendanceOrMarks =
        await PeCapacityService.hasAttendanceOrMarksForCourse(courseId);

      const students = registrations.map((reg) => {
        const section = resolveStudentSection(reg.student);
        const batchId = assignmentByStudent.get(reg.student.id) ?? null;
        return {
          studentId: reg.student.id,
          usn: reg.student.usn,
          name: reg.student.user.name,
          sectionId: section?.id ?? null,
          sectionName: section?.name ?? null,
          electiveBatchId: batchId,
          locked: hasAttendanceOrMarks && batchId !== null,
        };
      });

      const batchMap = new Map(batches.map((b) => [b.id, b]));
      const studentsWithBatchInfo = students.map((s) => {
        const batch = s.electiveBatchId
          ? batchMap.get(s.electiveBatchId)
          : undefined;
        return {
          ...s,
          batchName: batch?.name ?? null,
          batchSectionId: batch?.sectionId ?? null,
        };
      });

      const data = {
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
          projectGroupingScope: course.projectGroupingScope,
          numberOfBatches: course.numberOfBatches,
          studentsPerBatch: course.studentsPerBatch,
          electiveMappingVersion: course.electiveMappingVersion,
          semesterId: course.semesterId,
          cycle: course.cycle,
          hasAttendanceOrMarks,
        },
        students: studentsWithBatchInfo,
        batches: batches.map((b) => ({
          id: b.id,
          name: b.name,
          sortOrder: b.sortOrder,
          sectionId: b.sectionId,
          studentCount: b._count.studentAssignments,
          facultyId: b.facultyAssignment?.facultyId ?? null,
          facultyName:
            b.facultyAssignment?.faculty?.user.name ??
            b.facultyAssignment?.faculty?.shortName ??
            null,
        })),
      };

      return {
        status: "success",
        message: "Project course detail fetched",
        data,
      };
    } catch (error) {
      logger.error("ProjectMappingService.getCourseDetail failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to fetch project course detail");
    }
  }

  static async getGroups(
    courseId: string,
    query: {
      page: number;
      limit: number;
      search?: string;
      status?: "ASSIGNED" | "UNASSIGNED" | "ALL";
      facultyId?: string;
      sectionId?: string;
    },
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }

      const page = Math.max(1, query.page || 1);
      const limit = Math.min(100, Math.max(1, query.limit || 25));

      const search = query.search?.trim();
      const where: Prisma.ElectiveBatchWhereInput = {
        courseId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                {
                  studentAssignments: {
                    some: {
                      student: {
                        OR: [
                          { usn: { contains: search, mode: "insensitive" } },
                          {
                            user: {
                              name: { contains: search, mode: "insensitive" },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(query.status === "ASSIGNED"
          ? { facultyAssignment: { isNot: null } }
          : {}),
        ...(query.status === "UNASSIGNED"
          ? { facultyAssignment: { is: null } }
          : {}),
        ...(query.facultyId
          ? { facultyAssignment: { is: { facultyId: query.facultyId } } }
          : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      };

      const [total, items] = await Promise.all([
        db.electiveBatch.count({ where }),
        db.electiveBatch.findMany({
          where,
          orderBy: { sortOrder: "asc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            sectionId: true,
            _count: { select: { studentAssignments: true } },
            section: { select: { name: true } },
            facultyAssignment: {
              select: {
                facultyId: true,
                faculty: {
                  select: {
                    shortName: true,
                    user: { select: { name: true } },
                  },
                },
              },
            },
          },
        }),
      ]);

      const [totalAll, assignedCount] = await Promise.all([
        db.electiveBatch.count({ where: { courseId } }),
        db.electiveBatch.count({
          where: { courseId, facultyAssignment: { isNot: null } },
        }),
      ]);

      const data = {
        items: items.map((batch) => ({
          id: batch.id,
          name: batch.name,
          sectionId: batch.sectionId,
          sectionName: batch.section?.name ?? null,
          studentCount: batch._count.studentAssignments,
          studentsPerGroup: course.studentsPerBatch,
          facultyId: batch.facultyAssignment?.facultyId ?? null,
          facultyName:
            batch.facultyAssignment?.faculty?.user.name ??
            batch.facultyAssignment?.faculty?.shortName ??
            null,
          status: batch.facultyAssignment ? "ASSIGNED" : "UNASSIGNED",
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        summary: {
          total: totalAll,
          assigned: assignedCount,
          unassigned: totalAll - assignedCount,
        },
      };

      return { status: "success", message: "Project groups fetched", data };
    } catch (error) {
      logger.error("ProjectMappingService.getGroups failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to fetch project groups");
    }
  }

  static async getGroupDetail(
    courseId: string,
    groupId: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }

      const batch = await db.electiveBatch.findFirst({
        where: { id: groupId, courseId },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          sectionId: true,
          section: { select: { name: true } },
          facultyAssignment: {
            select: {
              facultyId: true,
              faculty: {
                select: {
                  id: true,
                  shortName: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      if (!batch) {
        throw new Error("Project group not found");
      }

      const members = await db.electiveStudentAssignment.findMany({
        where: { courseId, electiveBatchId: groupId },
        select: {
          student: {
            select: {
              id: true,
              usn: true,
              user: { select: { name: true } },
              semesterId: true,
              studentSections: {
                select: {
                  section: {
                    select: { id: true, name: true, semesterId: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { student: { usn: "asc" } },
      });

      const data = {
        group: {
          id: batch.id,
          name: batch.name,
          sortOrder: batch.sortOrder,
          sectionId: batch.sectionId,
          sectionName: batch.section?.name ?? null,
          studentsPerGroup: course.studentsPerBatch,
          facultyId: batch.facultyAssignment?.facultyId ?? null,
          facultyName:
            batch.facultyAssignment?.faculty?.user.name ??
            batch.facultyAssignment?.faculty?.shortName ??
            null,
        },
        members: members.map((m) => {
          const section = resolveStudentSection(m.student);
          return {
            studentId: m.student.id,
            usn: m.student.usn,
            name: m.student.user.name,
            sectionId: section?.id ?? null,
            sectionName: section?.name ?? null,
          };
        }),
      };

      return {
        status: "success",
        message: "Project group detail fetched",
        data,
      };
    } catch (error) {
      logger.error("ProjectMappingService.getGroupDetail failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to fetch project group detail");
    }
  }

  static async saveAssignments(
    payload: ProjectMappingSave,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        payload.courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }

      const { registrations, registeredIds, batchMap } =
        await ProjectMappingService.loadStudentContext(course.id);
      ProjectMappingService.validateStudentAssignments(
        course,
        payload.assignments,
        registrations,
        registeredIds,
        batchMap
      );
      await ProjectMappingService.assertStudentMovesAllowed(
        course.id,
        payload.assignments
      );

      const newVersion = await db.$transaction(async (tx) => {
        await tx.electiveStudentAssignment.deleteMany({
          where: { courseId: course.id },
        });
        await tx.electiveStudentAssignment.createMany({
          data: payload.assignments.map((a) => ({
            courseId: course.id,
            studentId: a.studentId,
            electiveBatchId: a.electiveBatchId,
          })),
        });
        return checkAndIncrementElectiveMappingVersion(
          course.id,
          payload.electiveMappingVersion,
          tx
        );
      });

      await logChanges({
        entityType: "COURSE",
        entityId: course.id,
        courseId: course.id,
        action: "SUPER_EDIT",
        changes: [
          {
            fieldName: "electiveStudentAssignments",
            oldValue: null,
            newValue: `${payload.assignments.length} students`,
          },
        ],
        adminUserId: context?.adminUserId ?? requestingUserId,
        reason: context?.reason,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return {
        status: "success",
        message: "Project group assignments saved",
        data: { electiveMappingVersion: newVersion },
      };
    } catch (error) {
      logger.error("ProjectMappingService.saveAssignments failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to save project group assignments");
    }
  }

  static async saveFaculty(
    payload: ProjectMappingSaveFaculty,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        payload.courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }

      await assertFacultyReassignmentAllowed(course.id);

      await ProjectMappingService.validateFacultyAssignments(
        course.id,
        payload.assignments
      );

      const semester = course.semesterNumber;
      const academicYear = course.semester.academicTerm.year;

      const newVersion = await db.$transaction(async (tx) => {
        await tx.electiveBatchFaculty.deleteMany({
          where: { courseId: course.id, semester, academicYear },
        });
        const rows = payload.assignments
          .filter((a) => a.facultyId !== null)
          .map((a) => ({
            courseId: course.id,
            electiveBatchId: a.electiveBatchId,
            facultyId: a.facultyId as string,
            semester,
            academicYear,
          }));
        if (rows.length > 0) {
          await tx.electiveBatchFaculty.createMany({ data: rows });
        }
        if (payload.electiveMappingVersion != null) {
          return checkAndIncrementElectiveMappingVersion(
            course.id,
            payload.electiveMappingVersion,
            tx
          );
        }
        await tx.course.update({
          where: { id: course.id },
          data: { electiveMappingVersion: { increment: 1 } },
        });
        return null;
      });

      return {
        status: "success",
        message: "Project group faculty mapping saved",
        data:
          newVersion != null ? { electiveMappingVersion: newVersion } : null,
      };
    } catch (error) {
      logger.error("ProjectMappingService.saveFaculty failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to save project group faculty mapping");
    }
  }

  static async bulkAssign(
    payload: ProjectMappingBulkAssign,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        payload.courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }

      await assertFacultyReassignmentAllowed(course.id);

      const facultyExists = await db.faculty.count({
        where: { id: payload.facultyId },
      });
      if (facultyExists === 0) {
        throw new Error("Faculty record is invalid");
      }

      const rows = payload.electiveBatchIds.map((id) => ({
        electiveBatchId: id,
        facultyId: payload.facultyId,
      }));
      await ProjectMappingService.validateFacultyAssignments(course.id, rows);

      const semester = course.semesterNumber;
      const academicYear = course.semester.academicTerm.year;

      const newVersion = await db.$transaction(async (tx) => {
        await tx.electiveBatchFaculty.deleteMany({
          where: {
            courseId: course.id,
            electiveBatchId: { in: payload.electiveBatchIds },
            semester,
            academicYear,
          },
        });
        await tx.electiveBatchFaculty.createMany({
          data: payload.electiveBatchIds.map((id) => ({
            courseId: course.id,
            electiveBatchId: id,
            facultyId: payload.facultyId,
            semester,
            academicYear,
          })),
        });
        if (payload.electiveMappingVersion != null) {
          return checkAndIncrementElectiveMappingVersion(
            course.id,
            payload.electiveMappingVersion,
            tx
          );
        }
        await tx.course.update({
          where: { id: course.id },
          data: { electiveMappingVersion: { increment: 1 } },
        });
        return null;
      });

      return {
        status: "success",
        message: `${payload.electiveBatchIds.length} project groups assigned to faculty`,
        data:
          newVersion != null ? { electiveMappingVersion: newVersion } : null,
      };
    } catch (error) {
      logger.error("ProjectMappingService.bulkAssign failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to assign project groups");
    }
  }

  static async saveFullMapping(
    payload: ProjectMappingSave,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        payload.courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }
      if (!payload.faculty) {
        throw new Error("Faculty assignments are required for unified save");
      }
      const faculty = payload.faculty;

      const { registrations, registeredIds, batchMap } =
        await ProjectMappingService.loadStudentContext(course.id);
      ProjectMappingService.validateStudentAssignments(
        course,
        payload.assignments,
        registrations,
        registeredIds,
        batchMap
      );
      await ProjectMappingService.validateFacultyAssignments(
        course.id,
        faculty
      );

      const groups = await db.electiveBatch.findMany({
        where: { courseId: course.id },
        select: { id: true },
      });
      const facultyByGroup = new Map(
        faculty
          .filter((f) => f.facultyId !== null)
          .map((f) => [f.electiveBatchId, f.facultyId as string])
      );
      if (facultyByGroup.size !== groups.length) {
        throw new Error(
          "Every active project group must have exactly one faculty assigned"
        );
      }
      for (const group of groups) {
        if (!facultyByGroup.has(group.id)) {
          throw new Error(
            "Every active project group must have exactly one faculty assigned"
          );
        }
      }

      const semester = course.semesterNumber;
      const academicYear = course.semester.academicTerm.year;

      const [existingStudentRows, existingFacultyRows] = await Promise.all([
        db.electiveStudentAssignment.findMany({
          where: { courseId: course.id },
          select: { studentId: true, electiveBatchId: true },
        }),
        db.electiveBatchFaculty.findMany({
          where: { courseId: course.id, semester, academicYear },
          select: { electiveBatchId: true, facultyId: true },
        }),
      ]);

      const studentState = new Set(
        payload.assignments.map((a) => `${a.studentId}:${a.electiveBatchId}`)
      );
      const existingStudentState = new Set(
        existingStudentRows.map((e) => `${e.studentId}:${e.electiveBatchId}`)
      );
      const facultyState = new Set(
        faculty
          .filter((f) => f.facultyId !== null)
          .map((f) => `${f.electiveBatchId}:${f.facultyId as string}`)
      );
      const existingFacultyState = new Set(
        existingFacultyRows.map((e) => `${e.electiveBatchId}:${e.facultyId}`)
      );

      const isNoOp =
        studentState.size === existingStudentState.size &&
        facultyState.size === existingFacultyState.size &&
        payload.assignments.every((a) =>
          existingStudentState.has(`${a.studentId}:${a.electiveBatchId}`)
        ) &&
        faculty.every(
          (f) =>
            f.facultyId === null ||
            existingFacultyState.has(`${f.electiveBatchId}:${f.facultyId}`)
        );

      if (isNoOp) {
        return {
          status: "success",
          message: "Project mapping is already up to date",
          data: { electiveMappingVersion: course.electiveMappingVersion },
        };
      }

      await ProjectMappingService.assertStudentMovesAllowed(
        course.id,
        payload.assignments
      );
      await assertFacultyReassignmentAllowed(course.id);

      const newVersion = await db.$transaction(async (tx) => {
        const version = await checkAndIncrementElectiveMappingVersion(
          course.id,
          payload.electiveMappingVersion,
          tx
        );
        await tx.electiveStudentAssignment.deleteMany({
          where: { courseId: course.id },
        });
        await tx.electiveStudentAssignment.createMany({
          data: payload.assignments.map((a) => ({
            courseId: course.id,
            studentId: a.studentId,
            electiveBatchId: a.electiveBatchId,
          })),
        });
        await tx.electiveBatchFaculty.deleteMany({
          where: { courseId: course.id, semester, academicYear },
        });
        const facultyRows = faculty
          .filter((f) => f.facultyId !== null)
          .map((f) => ({
            courseId: course.id,
            electiveBatchId: f.electiveBatchId,
            facultyId: f.facultyId as string,
            semester,
            academicYear,
          }));
        if (facultyRows.length > 0) {
          await tx.electiveBatchFaculty.createMany({ data: facultyRows });
        }
        return version;
      });

      await logChanges({
        entityType: "COURSE",
        entityId: course.id,
        courseId: course.id,
        action: "SUPER_EDIT",
        changes: [
          {
            fieldName: "projectMapping",
            oldValue: null,
            newValue: `${payload.assignments.length} students, ${facultyByGroup.size} project group faculties`,
          },
        ],
        adminUserId: context?.adminUserId ?? requestingUserId,
        reason: context?.reason,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return {
        status: "success",
        message: "Project mapping saved",
        data: { electiveMappingVersion: newVersion },
      };
    } catch (error) {
      logger.error("ProjectMappingService.saveFullMapping failed", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to save project mapping");
    }
  }

  static async generateTemplate(
    courseId: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<Buffer> {
    const department = await ProjectMappingService.resolveDepartment(
      requestingUserId,
      context
    );
    const course = await db.course.findFirst({
      where: { id: courseId, departmentId: department.id, courseType: "PW" },
      include: { semester: { include: { academicTerm: true } } },
    });
    if (!course) {
      throw new Error("PW course not found");
    }

    const semester = course.semesterNumber;
    const academicYear = course.semester.academicTerm.year;

    const batches = await db.electiveBatch.findMany({
      where: { courseId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        facultyAssignment: {
          select: {
            semester: true,
            academicYear: true,
            faculty: {
              select: { shortName: true, user: { select: { name: true } } },
            },
          },
        },
      },
    });

    const assignments = await db.electiveStudentAssignment.findMany({
      where: { courseId },
      select: {
        electiveBatchId: true,
        student: {
          select: { usn: true, user: { select: { name: true } } },
        },
      },
      orderBy: { student: { usn: "asc" } },
    });

    const studentsByGroup = new Map<
      string,
      Array<{ usn: string; name: string }>
    >();
    for (const assignment of assignments) {
      const members = studentsByGroup.get(assignment.electiveBatchId) ?? [];
      members.push({
        usn: assignment.student.usn,
        name: assignment.student.user.name,
      });
      studentsByGroup.set(assignment.electiveBatchId, members);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Project Mapping");

    worksheet.addRow([
      "Academic Term",
      `${course.semester.academicTerm.type} ${academicYear}`,
    ]);
    worksheet.addRow(["Semester", semester]);
    worksheet.addRow([
      "Department or Cycle",
      course.cycle !== "NONE" ? course.cycle : (course.departmentName ?? ""),
    ]);
    worksheet.addRow(["Course Name", course.name]);
    worksheet.addRow(["Course Code", course.code]);
    worksheet.addRow([
      "USN:Student",
      "One student per row, or multiple comma-separated entries. Example: USN001:Keshav, USN002:Rahul",
    ]);

    const headerRow = worksheet.addRow(["Group", "Faculty", "USN:Student"]);
    headerRow.font = { bold: true };

    for (const batch of batches) {
      const fa =
        batch.facultyAssignment &&
        batch.facultyAssignment.semester === semester &&
        batch.facultyAssignment.academicYear === academicYear
          ? batch.facultyAssignment
          : null;
      const facultyName = fa
        ? (fa.faculty.user?.name ?? fa.faculty.shortName ?? "")
        : "";
      const members = studentsByGroup.get(batch.id) ?? [];
      if (members.length === 0) {
        worksheet.addRow([batch.name, facultyName, ""]);
      } else {
        for (const member of members) {
          worksheet.addRow([
            batch.name,
            facultyName,
            `${member.usn}:${member.name}`,
          ]);
        }
      }
    }

    worksheet.getColumn(1).width = 12;
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(3).width = 45;

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  static async validateUpload(
    courseId: string,
    fileBuffer: Buffer,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await ProjectMappingService.resolveDepartment(
        requestingUserId,
        context
      );
      const course = await ProjectMappingService.getPwCourse(
        courseId,
        department.id
      );
      if (!course) {
        throw new Error("PW course not found");
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error("Invalid Excel file format");
      }

      const batches = await db.electiveBatch.findMany({
        where: { courseId },
        select: { id: true, name: true, sectionId: true },
      });
      const batchByName = new Map(
        batches.map((b) => [b.name.toUpperCase(), b])
      );

      const registrations = await db.courseRegistration.findMany({
        where: { courseId },
        select: {
          studentId: true,
          student: {
            select: {
              id: true,
              usn: true,
              departmentName: true,
              semesterId: true,
              studentSections: {
                select: {
                  section: {
                    select: {
                      id: true,
                      name: true,
                      cycle: true,
                      semesterId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      const studentByUsn = new Map(
        registrations.map((r) => [r.student.usn.toUpperCase(), r])
      );

      // Project guides may come from any department, so resolve names
      // across the whole college.
      const facultyRecords = await db.faculty.findMany({
        where: {},
        select: {
          id: true,
          shortName: true,
          departmentId: true,
          user: { select: { name: true } },
        },
      });
      const facultyByName = new Map<
        string,
        Map<string, { id: string; departmentId: string }>
      >();
      for (const record of facultyRecords) {
        const add = (key: string) => {
          const bucket = facultyByName.get(key) ?? new Map();
          bucket.set(record.id, {
            id: record.id,
            departmentId: record.departmentId,
          });
          facultyByName.set(key, bucket);
        };
        if (record.user.name) add(record.user.name.toLowerCase());
        if (record.shortName) add(record.shortName.toLowerCase());
      }

      const errors: ProjectMappingExcelError[] = [];
      const assignments: Array<{ studentId: string; electiveBatchId: string }> =
        [];
      const capacityCounts = new Map<string, number>();
      const seenGroups = new Set<string>();
      const seenStudents = new Set<string>();
      const facultyByGroup = new Map<
        string,
        { facultyId: string | null; row: number }
      >();
      let dataRowCount = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 7) return;
        const groupName = String(row.getCell(1).text).trim();
        const facultyName = String(row.getCell(2).text).trim();
        const usnCell = String(row.getCell(3).text).trim();
        if (!groupName && !facultyName && !usnCell) return;

        dataRowCount += 1;
        if (dataRowCount > MAX_EXCEL_DATA_ROWS) {
          throw new ProjectMappingExcelValidationError([
            {
              row: rowNumber,
              column: null,
              code: "EXCEEDS_ROW_LIMIT",
              message: `Excel file exceeds the maximum supported number of rows (${MAX_EXCEL_DATA_ROWS}).`,
            },
          ]);
        }

        const studentEntries = parseStudentCell(usnCell);
        const batch = groupName
          ? batchByName.get(groupName.toUpperCase())
          : undefined;

        if (!batch) {
          errors.push({
            row: rowNumber,
            column: "Group",
            code: "UNKNOWN_GROUP",
            message: `Row ${rowNumber}: Unknown project group "${groupName}"`,
            value: groupName,
          });
        } else {
          seenGroups.add(batch.id);
          if (facultyByGroup.has(batch.id)) {
            errors.push({
              row: rowNumber,
              column: "Group",
              code: "DUPLICATE_GROUP",
              message: `Row ${rowNumber}: Project group "${groupName}" appears more than once`,
              value: groupName,
            });
          } else {
            let resolvedFacultyId: string | null = null;
            if (facultyName) {
              const candidates = facultyByName.get(facultyName.toLowerCase());
              const deduped = candidates ? Array.from(candidates.values()) : [];
              if (deduped.length === 0) {
                errors.push({
                  row: rowNumber,
                  column: "Faculty",
                  code: "UNKNOWN_FACULTY",
                  message: `Row ${rowNumber}: Faculty "${facultyName}" was not found`,
                  value: facultyName,
                });
              } else if (deduped.length > 1) {
                errors.push({
                  row: rowNumber,
                  column: "Faculty",
                  code: "AMBIGUOUS_FACULTY",
                  message: `Row ${rowNumber}: Faculty "${facultyName}" matches multiple faculty records`,
                  value: facultyName,
                });
              } else {
                resolvedFacultyId = (deduped[0] as { id: string }).id;
              }
            }
            facultyByGroup.set(batch.id, {
              facultyId: resolvedFacultyId,
              row: rowNumber,
            });
          }
        }

        if (studentEntries.length === 0) return;

        for (const { usn } of studentEntries) {
          const reg = studentByUsn.get(usn);
          if (!reg) {
            errors.push({
              row: rowNumber,
              column: "USN:Student",
              code: "UNKNOWN_USN",
              message: `Row ${rowNumber}: Student ${usn} is not registered for this PW course`,
              value: usn,
            });
            continue;
          }
          if (seenStudents.has(reg.studentId)) {
            errors.push({
              row: rowNumber,
              column: "USN:Student",
              code: "DUPLICATE_STUDENT",
              message: `Row ${rowNumber}: Student ${usn} appears more than once`,
              value: usn,
            });
            continue;
          }
          seenStudents.add(reg.studentId);

          if (!batch) {
            continue;
          }

          if (course.projectGroupingScope === "WITHIN_SECTION") {
            const section = resolveStudentSection(reg.student);
            if (
              !section ||
              !batch.sectionId ||
              section.id !== batch.sectionId
            ) {
              errors.push({
                row: rowNumber,
                column: "USN:Student",
                code: "WRONG_SECTION",
                message: `Row ${rowNumber}: Student ${usn} cannot be placed in a group outside their section`,
                value: usn,
              });
              continue;
            }
          }

          const current = capacityCounts.get(batch.id) ?? 0;
          capacityCounts.set(batch.id, current + 1);
          if (
            course.studentsPerBatch &&
            current + 1 > course.studentsPerBatch
          ) {
            errors.push({
              row: rowNumber,
              column: "USN:Student",
              code: "OVER_CAPACITY",
              message: `Row ${rowNumber}: Group ${groupName} exceeds the students-per-group limit of ${course.studentsPerBatch}`,
              value: usn,
            });
            continue;
          }

          assignments.push({
            studentId: reg.studentId,
            electiveBatchId: batch.id,
          });
        }
      });

      for (const batch of batches) {
        if (!seenGroups.has(batch.id)) {
          errors.push({
            row: null,
            column: "Group",
            code: "MISSING_GROUP",
            message: `Project group ${batch.name} is missing from the file`,
            value: batch.name,
          });
        } else if (!facultyByGroup.get(batch.id)?.facultyId) {
          errors.push({
            row: facultyByGroup.get(batch.id)?.row ?? null,
            column: "Faculty",
            code: "MISSING_FACULTY",
            message: `Project group ${batch.name} has no faculty assigned`,
            value: batch.name,
          });
        }
      }

      for (const reg of registrations) {
        if (!seenStudents.has(reg.studentId)) {
          errors.push({
            row: null,
            column: "USN:Student",
            code: "MISSING_STUDENT",
            message: `Student ${reg.student.usn} is not assigned in the file`,
            value: reg.student.usn,
          });
        }
      }

      const hasAttendanceOrMarks =
        await PeCapacityService.hasAttendanceOrMarksForCourse(course.id);
      if (hasAttendanceOrMarks) {
        const existingStudents = await db.electiveStudentAssignment.findMany({
          where: { courseId },
          select: { studentId: true, electiveBatchId: true },
        });
        const existingByStudent = new Map(
          existingStudents.map((e) => [e.studentId, e.electiveBatchId])
        );
        for (const assignment of assignments) {
          const prev = existingByStudent.get(assignment.studentId);
          if (prev && prev !== assignment.electiveBatchId) {
            errors.push({
              row: null,
              column: "USN:Student",
              code: "LOCKED_AFTER_ATTENDANCE",
              message:
                "Student mappings cannot be changed after attendance or marks exist",
            });
            break;
          }
        }

        const semester = course.semesterNumber;
        const academicYear = course.semester.academicTerm.year;
        const existingFaculty = await db.electiveBatchFaculty.findMany({
          where: { courseId, semester, academicYear },
          select: { electiveBatchId: true, facultyId: true },
        });
        const existingByGroup = new Map(
          existingFaculty.map((e) => [e.electiveBatchId, e.facultyId])
        );
        for (const [groupId, value] of facultyByGroup.entries()) {
          const prev = existingByGroup.get(groupId);
          if (value.facultyId && prev && value.facultyId !== prev) {
            errors.push({
              row: value.row,
              column: "Faculty",
              code: "LOCKED_AFTER_ATTENDANCE",
              message:
                "Faculty assignments cannot be changed after attendance or marks exist",
            });
          }
        }
      }

      if (errors.length > 0) {
        throw new ProjectMappingExcelValidationError(errors);
      }

      const facultyAssignments: ProjectFacultyAssignmentInput[] = Array.from(
        facultyByGroup.entries()
      )
        .filter(
          (entry): entry is [string, { facultyId: string; row: number }] =>
            Boolean(entry[1].facultyId)
        )
        .map(([electiveBatchId, value]) => ({
          electiveBatchId,
          facultyId: value.facultyId,
        }));

      return {
        status: "success",
        message: "Excel validated successfully. Please verify before saving.",
        data: { assignments, facultyAssignments },
      };
    } catch (error) {
      logger.error("ProjectMappingService.validateUpload failed", error);
      throw error instanceof Error
        ? error
        : new Error("Excel validation failed");
    }
  }
}

/**
 * Splits a "USN:Student" worksheet cell into individual student entries.
 *
 * One group row may hold several students, either as `USN:Name` pairs or as
 * bare USNs:
 *
 *   "1BM22CS001:Keshav, 1BM22CS002:Rahul, 1BM22CS003:Ananya"
 *   "1BM22CS001, 1BM22CS002, 1BM22CS003"
 *
 * Entries are split on commas, trimmed, empty entries (e.g. accidental
 * trailing commas) are ignored. The USN is the text before the first ":"
 * (uppercased); the name after it is display-only.
 */
function parseStudentCell(cell: string): Array<{ usn: string; name: string }> {
  const entries: Array<{ usn: string; name: string }> = [];
  for (const raw of cell.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) {
      entries.push({ usn: entry.toUpperCase(), name: "" });
    } else {
      entries.push({
        usn: entry.slice(0, colonIndex).trim().toUpperCase(),
        name: entry.slice(colonIndex + 1).trim(),
      });
    }
  }
  return entries;
}

async function removeBatches(
  tx: TxClient,
  courseId: string,
  batchIds: string[]
): Promise<void> {
  if (batchIds.length === 0) return;
  await tx.electiveBatchFaculty.deleteMany({
    where: { electiveBatchId: { in: batchIds }, courseId },
  });
  await tx.electiveStudentAssignment.deleteMany({
    where: { electiveBatchId: { in: batchIds }, courseId },
  });
  await tx.electiveBatch.deleteMany({
    where: { id: { in: batchIds }, courseId },
  });
}
