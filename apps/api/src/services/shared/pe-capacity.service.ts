import { CourseApprovalStatus, db, Prisma } from "@webcampus/db";

export type PeCapacityScope = {
  departmentId: string | null;
  semesterId: string;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
};

export type PeCapacityPhase = "before_registration" | "registration_started";

export function peCourseCapacity(
  numberOfBatches: number | null | undefined,
  studentsPerBatch: number | null | undefined
): number {
  const batches = numberOfBatches ?? 0;
  const perBatch = studentsPerBatch ?? 0;
  return Math.max(0, batches) * Math.max(0, perBatch);
}

export function seatsLeft(capacity: number, registeredCount: number): number {
  return Math.max(0, capacity - registeredCount);
}

export function isPeFull(capacity: number, registeredCount: number): boolean {
  return capacity <= 0 ? true : registeredCount >= capacity;
}

type TxClient = Prisma.TransactionClient | typeof db;

export class PeCapacityService {
  static async getRegistrationPhase(
    scope: PeCapacityScope,
    tx: TxClient = db
  ): Promise<PeCapacityPhase> {
    const hasAnyRegistration = await tx.courseRegistration.findFirst({
      where: {
        semesterId: scope.semesterId,
        course: {
          courseType: "PE",
          ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
          ...(scope.cycle ? { cycle: scope.cycle } : {}),
        },
      },
      select: { id: true },
    });

    if (hasAnyRegistration) {
      return "registration_started";
    }

    const windowOpen = await tx.registrationWindow.findFirst({
      where: {
        semesterId: scope.semesterId,
        isOpen: true,
        departmentId: scope.departmentId,
        cycle: scope.cycle,
      },
      select: { id: true },
    });

    if (windowOpen) {
      return "registration_started";
    }

    return "before_registration";
  }

  static async countEligibleStudents(
    scope: PeCapacityScope,
    tx: TxClient = db
  ): Promise<number> {
    if (scope.cycle) {
      return tx.student.count({
        where: {
          semesterId: scope.semesterId,
          studentSections: {
            some: {
              section: {
                cycle: scope.cycle,
                semesterId: scope.semesterId,
              },
            },
          },
        },
      });
    }

    if (!scope.departmentId) {
      throw new Error(
        "departmentId is required for non-cycle PE capacity scope"
      );
    }

    const department = await tx.department.findUnique({
      where: { id: scope.departmentId },
      select: { name: true },
    });

    if (!department) {
      throw new Error("Department not found for PE capacity scope");
    }

    return tx.student.count({
      where: {
        semesterId: scope.semesterId,
        departmentName: department.name,
      },
    });
  }

  static async sumPeCapacityInScope(
    scope: PeCapacityScope,
    options: {
      excludeCourseId?: string;
      overrideForCourseId?: string;
      overrideNumberOfBatches?: number;
      overrideStudentsPerBatch?: number;
      statuses?: CourseApprovalStatus[];
    } = {},
    tx: TxClient = db
  ): Promise<number> {
    const courses = await tx.course.findMany({
      where: {
        semesterId: scope.semesterId,
        courseType: "PE",
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...(scope.cycle ? { cycle: scope.cycle } : {}),
        ...(options.statuses
          ? { approvalStatus: { in: options.statuses } }
          : {}),
        ...(options.excludeCourseId
          ? { id: { not: options.excludeCourseId } }
          : {}),
      },
      select: {
        id: true,
        numberOfBatches: true,
        studentsPerBatch: true,
      },
    });

    let total = 0;
    for (const course of courses) {
      if (
        options.overrideForCourseId &&
        course.id === options.overrideForCourseId
      ) {
        total += peCourseCapacity(
          options.overrideNumberOfBatches,
          options.overrideStudentsPerBatch
        );
      } else {
        total += peCourseCapacity(
          course.numberOfBatches,
          course.studentsPerBatch
        );
      }
    }

    if (
      options.overrideForCourseId &&
      !courses.some((c) => c.id === options.overrideForCourseId)
    ) {
      total += peCourseCapacity(
        options.overrideNumberOfBatches,
        options.overrideStudentsPerBatch
      );
    }

    return total;
  }

  static async countRegisteredInScope(
    scope: PeCapacityScope,
    tx: TxClient = db
  ): Promise<number> {
    return tx.courseRegistration.count({
      where: {
        semesterId: scope.semesterId,
        course: {
          courseType: "PE",
          ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
          ...(scope.cycle ? { cycle: scope.cycle } : {}),
        },
      },
    });
  }

  static async countRegisteredForCourse(
    courseId: string,
    tx: TxClient = db
  ): Promise<number> {
    return tx.courseRegistration.count({
      where: { courseId },
    });
  }

  static async assertCourseCapacityAboveRegistrations(params: {
    courseId: string;
    numberOfBatches: number;
    studentsPerBatch: number;
    tx?: TxClient;
  }): Promise<void> {
    const tx = params.tx ?? db;
    const registeredForCourse = await this.countRegisteredForCourse(
      params.courseId,
      tx
    );
    const courseCapacity = peCourseCapacity(
      params.numberOfBatches,
      params.studentsPerBatch
    );
    if (courseCapacity < registeredForCourse) {
      throw new Error(
        `PE course capacity cannot be below its registrations: capacity ${courseCapacity} < registered ${registeredForCourse}.`
      );
    }
  }

  static async getPeCapacitySummary(
    scope: PeCapacityScope,
    tx: TxClient = db
  ): Promise<{
    eligibleStudents: number;
    configuredCapacity: number;
    remainingSeats: number;
  }> {
    const [eligibleStudents, configuredCapacity] = await Promise.all([
      this.countEligibleStudents(scope, tx),
      this.sumPeCapacityInScope(
        scope,
        {
          statuses: [
            CourseApprovalStatus.PENDING,
            CourseApprovalStatus.APPROVED,
          ],
        },
        tx
      ),
    ]);
    return {
      eligibleStudents,
      configuredCapacity,
      remainingSeats: eligibleStudents - configuredCapacity,
    };
  }

  static async assertCourseSaveCapacityAllowed(params: {
    scope: PeCapacityScope;
    courseId?: string;
    numberOfBatches: number;
    studentsPerBatch: number;
    tx?: TxClient;
  }): Promise<void> {
    const tx = params.tx ?? db;
    const phase = await this.getRegistrationPhase(params.scope, tx);

    // Existing PE seats in scope (excluding the course being edited, if any)
    // plus the proposed capacity for this course.
    const othersCapacity = await this.sumPeCapacityInScope(
      params.scope,
      { excludeCourseId: params.courseId },
      tx
    );
    const totalCapacity =
      othersCapacity +
      peCourseCapacity(params.numberOfBatches, params.studentsPerBatch);

    if (phase === "before_registration") {
      const eligible = await this.countEligibleStudents(params.scope, tx);
      if (totalCapacity < eligible) {
        throw new Error(
          `PE capacity too low: total seats ${totalCapacity} < eligible students ${eligible}. Increase batches or students per batch across PE courses.`
        );
      }
      return;
    }

    const registeredInScope = await this.countRegisteredInScope(
      params.scope,
      tx
    );
    if (totalCapacity < registeredInScope) {
      throw new Error(
        `PE capacity cannot be below registered students: total seats ${totalCapacity} < registered ${registeredInScope}.`
      );
    }

    if (params.courseId) {
      const registeredForCourse = await this.countRegisteredForCourse(
        params.courseId,
        tx
      );
      const courseCapacity = peCourseCapacity(
        params.numberOfBatches,
        params.studentsPerBatch
      );
      if (courseCapacity < registeredForCourse) {
        throw new Error(
          `PE course capacity cannot be below its registrations: capacity ${courseCapacity} < registered ${registeredForCourse}.`
        );
      }
    }
  }

  static async hasAttendanceOrMarksForCourse(
    courseId: string,
    tx: TxClient = db
  ): Promise<boolean> {
    const [attendance, marks, session] = await Promise.all([
      tx.attendance.findFirst({
        where: { courseId },
        select: { id: true },
      }),
      tx.mark.findFirst({
        where: { courseId },
        select: { id: true },
      }),
      tx.classSession.findFirst({
        where: { courseId },
        select: { id: true },
      }),
    ]);
    return Boolean(attendance || marks || session);
  }

  static async hasAttendanceOrMarksInScope(
    scope: PeCapacityScope,
    tx: TxClient = db
  ): Promise<boolean> {
    const peCourses = await tx.course.findMany({
      where: {
        semesterId: scope.semesterId,
        courseType: "PE",
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...(scope.cycle ? { cycle: scope.cycle } : {}),
      },
      select: { id: true },
    });

    if (peCourses.length === 0) {
      return false;
    }

    const courseIds = peCourses.map((c) => c.id);
    const [attendance, marks, session] = await Promise.all([
      tx.attendance.findFirst({
        where: { courseId: { in: courseIds } },
        select: { id: true },
      }),
      tx.mark.findFirst({
        where: { courseId: { in: courseIds } },
        select: { id: true },
      }),
      tx.classSession.findFirst({
        where: { courseId: { in: courseIds } },
        select: { id: true },
      }),
    ]);
    return Boolean(attendance || marks || session);
  }

  static computePeFacultyMapping(
    batches: Array<{
      facultyAssignment: {
        semester: number;
        academicYear: string;
      } | null;
    }>,
    semesterNumber?: number | null,
    academicYear?: string
  ): {
    expectedAssignments: number;
    assignedAssignments: number;
    isFullyMapped: boolean;
    isPartiallyMapped: boolean;
    isUnmapped: boolean;
  } {
    const expectedAssignments = batches.length;
    const assignedAssignments = batches.filter((b) => {
      const fa = b.facultyAssignment;
      if (!fa) return false;
      return (
        semesterNumber == null ||
        (fa.semester === semesterNumber && fa.academicYear === academicYear)
      );
    }).length;

    return {
      expectedAssignments,
      assignedAssignments,
      isFullyMapped:
        expectedAssignments > 0 && assignedAssignments === expectedAssignments,
      isPartiallyMapped:
        assignedAssignments > 0 && assignedAssignments < expectedAssignments,
      isUnmapped: assignedAssignments === 0 || expectedAssignments === 0,
    };
  }

  static async isFacultyMappingComplete(
    courseId: string,
    semesterNumber?: number | null,
    academicYear?: string,
    tx: TxClient = db
  ): Promise<boolean> {
    const batches = await tx.electiveBatch.findMany({
      where: { courseId },
      select: {
        id: true,
        facultyAssignment: {
          select: { id: true, semester: true, academicYear: true },
        },
      },
    });
    return this.computePeFacultyMapping(batches, semesterNumber, academicYear)
      .isFullyMapped;
  }

  static async isElectiveMappingComplete(
    courseId: string,
    tx: TxClient = db
  ): Promise<boolean> {
    const registrations = await tx.courseRegistration.findMany({
      where: { courseId },
      select: { studentId: true },
    });
    if (registrations.length === 0) {
      return true;
    }
    const assigned = await tx.electiveStudentAssignment.count({
      where: { courseId },
    });
    return assigned >= registrations.length;
  }

  static async assertPeDownstreamReady(
    courseId: string,
    tx: TxClient = db
  ): Promise<void> {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { courseType: true, code: true },
    });
    if (!course || course.courseType !== "PE") {
      return;
    }
    const [facultyOk, electiveOk] = await Promise.all([
      this.isFacultyMappingComplete(courseId, undefined, undefined, tx),
      this.isElectiveMappingComplete(courseId, tx),
    ]);
    if (!facultyOk || !electiveOk) {
      throw new Error(
        `PE course ${course.code} requires both faculty mapping and elective student mapping before attendance, marks, or hall tickets.`
      );
    }
  }

  static async getFacultyPeRoster(
    facultyId: string,
    courseId: string,
    tx: TxClient = db
  ): Promise<{ studentId: string }[]> {
    const batches = await tx.electiveBatchFaculty.findMany({
      where: { facultyId, courseId },
      select: { electiveBatchId: true },
    });
    if (batches.length === 0) {
      return [];
    }
    return tx.electiveStudentAssignment.findMany({
      where: {
        courseId,
        electiveBatchId: { in: batches.map((b) => b.electiveBatchId) },
      },
      select: { studentId: true },
    });
  }
}

export async function syncBatchManagedCourseBatches(params: {
  tx: Prisma.TransactionClient;
  courseId: string;
  courseCode: string;
  targetCount: number;
  batchesToRemoveIds?: string[];
}): Promise<void> {
  const existing = await params.tx.electiveBatch.findMany({
    where: { courseId: params.courseId },
    orderBy: { sortOrder: "asc" },
  });

  let structuralChange = false;

  if (params.targetCount < existing.length) {
    structuralChange = true;
    const removeIds =
      params.batchesToRemoveIds ??
      existing.slice(params.targetCount).map((b) => b.id);
    if (removeIds.length !== existing.length - params.targetCount) {
      throw new Error(
        "When decreasing the number of batches, you must select which batches to remove."
      );
    }

    // Ownership validation inside the transaction: every requested batch id
    // must belong to this course, otherwise nothing is deleted.
    const ownedCount = await params.tx.electiveBatch.count({
      where: { id: { in: removeIds }, courseId: params.courseId },
    });
    if (ownedCount !== removeIds.length) {
      throw new Error(
        "One or more elective batches to remove do not belong to this course."
      );
    }

    // Auto-unmap faculty and auto-unassign students for removed batches
    await params.tx.electiveBatchFaculty.deleteMany({
      where: { electiveBatchId: { in: removeIds }, courseId: params.courseId },
    });
    await params.tx.electiveStudentAssignment.deleteMany({
      where: { electiveBatchId: { in: removeIds }, courseId: params.courseId },
    });
    await params.tx.electiveBatch.deleteMany({
      where: { id: { in: removeIds }, courseId: params.courseId },
    });

    // Renumber the surviving batches back to a contiguous 1..N sequence and
    // realign auto-generated names ({code} 1..N) so a later re-grow can't
    // collide with the @@unique([courseId, sortOrder]) / @@unique([courseId,
    // name]) guards. Batches whose name does not match the current code prefix
    // (e.g. admin-renamed, or a previous code) are left untouched.
    const survivors = await params.tx.electiveBatch.findMany({
      where: { courseId: params.courseId },
      orderBy: { sortOrder: "asc" },
    });
    const codePrefix = `${params.courseCode} `;
    for (let i = 0; i < survivors.length; i++) {
      const batch = survivors[i];
      if (!batch) continue;
      const expectedName = `${params.courseCode} ${i + 1}`;
      if (batch.sortOrder !== i + 1 || batch.name !== expectedName) {
        await params.tx.electiveBatch.update({
          where: { id: batch.id },
          data: {
            sortOrder: i + 1,
            ...(batch.name.startsWith(codePrefix)
              ? { name: expectedName }
              : {}),
          },
        });
      }
    }
  } else if (params.targetCount > existing.length) {
    structuralChange = true;
    // Number from max(sortOrder) + 1, never from existing.length, so a
    // mid-list delete followed by a re-grow can't collide with the
    // @@unique([courseId, sortOrder]) / @@unique([courseId, name]) guards.
    const maxSortOrder =
      existing.length > 0 ? Math.max(...existing.map((b) => b.sortOrder)) : 0;
    for (let i = 1; i <= params.targetCount - existing.length; i++) {
      const next = maxSortOrder + i;
      await params.tx.electiveBatch.create({
        data: {
          courseId: params.courseId,
          name: `${params.courseCode} ${next}`,
          sortOrder: next,
        },
      });
    }
  }

  await params.tx.course.update({
    where: { id: params.courseId },
    data: {
      numberOfBatches: params.targetCount,
      ...(structuralChange ? { electiveMappingVersion: { increment: 1 } } : {}),
    },
  });
}
