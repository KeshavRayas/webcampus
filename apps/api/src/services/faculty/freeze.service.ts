import { db } from "@webcampus/db";
import type { Freeze, FreezeActorRole, Prisma } from "@webcampus/db";
import type { FreezeDisplayState } from "@webcampus/schemas/faculty";
import type { Role } from "@webcampus/types/rbac";
import { FACULTY_COURSE_STATUS } from "../shared/course-approval";
import { recomputeCourseMarks } from "../shared/mark-sync.service";

export type FrozenByInfo = {
  frozenByRole: FreezeActorRole | null;
  frozenByUsername: string | null;
  frozenByDisplay: string | null;
};

export type FreezeResolution = {
  raw: {
    facultyFrozen: boolean;
    hodFrozen: boolean;
    adminFrozen: boolean;
    facultyFrozenAt: Date | null;
    hodFrozenAt: Date | null;
    adminFrozenAt: Date | null;
  };
  displayState: FreezeDisplayState;
  lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenBy: FrozenByInfo;
  frozenAt: string | null;
  message: string | null;
};

export type LegacyFreezeState = {
  isLocked: boolean;
  lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
  facultyFrozen: boolean;
  hodFrozen: boolean;
  adminFrozen: boolean;
};

const forbidden = (detail: string): string => `Forbidden: ${detail}`;
const notFound = (entity: string): string => `${entity} not found`;

/**
 * Normalizes freeze booleans to the highest-precedence active freeze level.
 *
 * Precedence: ADMIN > HOD > FACULTY > OPEN
 *
 * Guarantee: displayState and lockedBy ALWAYS represent the single highest
 * active freeze level. Multiple simultaneous freeze booleans NEVER produce
 * multiple visible states — the highest wins unconditionally.
 */
const buildFrozenBy = (freeze: Freeze | null): FrozenByInfo => ({
  frozenByRole: freeze?.frozenByRole ?? null,
  frozenByUsername: freeze?.frozenByUsername ?? null,
  frozenByDisplay: freeze?.frozenByDisplay ?? null,
});

export const resolveFreezeState = (freeze: Freeze | null): FreezeResolution => {
  const raw = {
    facultyFrozen: freeze?.facultyFrozen ?? false,
    hodFrozen: freeze?.hodFrozen ?? false,
    adminFrozen: freeze?.adminFrozen ?? false,
    facultyFrozenAt: freeze?.facultyFrozenAt ?? null,
    hodFrozenAt: freeze?.hodFrozenAt ?? null,
    adminFrozenAt: freeze?.adminFrozenAt ?? null,
  };

  const frozenBy = buildFrozenBy(freeze);

  if (raw.adminFrozen) {
    return {
      raw,
      displayState: "LOCKED_BY_ADMIN",
      lockedBy: "ADMIN",
      frozenBy,
      frozenAt: raw.adminFrozenAt?.toISOString() ?? null,
      message: "Attendance locked by admin",
    };
  }

  if (raw.hodFrozen) {
    return {
      raw,
      displayState: "FROZEN_BY_HOD",
      lockedBy: "HOD",
      frozenBy,
      frozenAt: raw.hodFrozenAt?.toISOString() ?? null,
      message: "Attendance window closed by HOD",
    };
  }

  if (raw.facultyFrozen) {
    return {
      raw,
      displayState: "FROZEN_BY_FACULTY",
      lockedBy: "FACULTY",
      frozenBy,
      frozenAt: raw.facultyFrozenAt?.toISOString() ?? null,
      message: "Attendance frozen by faculty",
    };
  }

  return {
    raw,
    displayState: "OPEN",
    lockedBy: null,
    frozenBy,
    frozenAt: null,
    message: null,
  };
};

export const getFreezeState = (freeze: Freeze | null): LegacyFreezeState => {
  const resolved = resolveFreezeState(freeze);
  return {
    isLocked: resolved.displayState !== "OPEN",
    lockedBy: resolved.lockedBy,
    facultyFrozen: resolved.raw.facultyFrozen,
    hodFrozen: resolved.raw.hodFrozen,
    adminFrozen: resolved.raw.adminFrozen,
  };
};

export const canRoleMutateAttendance = (
  role: Role,
  freeze: FreezeResolution
): boolean => {
  switch (role) {
    case "admin":
      return false;
    case "hod":
    case "department":
      return !freeze.raw.adminFrozen;
    case "faculty":
      return (
        !freeze.raw.adminFrozen &&
        !freeze.raw.hodFrozen &&
        !freeze.raw.facultyFrozen
      );
    default:
      return false;
  }
};

export const canRoleManageFreezeWindow = (
  role: Role,
  freeze: FreezeResolution,
  action: "freeze" | "unfreeze"
): boolean => {
  if (action === "freeze") {
    switch (role) {
      case "admin":
        return true;
      case "hod":
      case "department":
        return !freeze.raw.adminFrozen;
      case "faculty":
        return (
          !freeze.raw.adminFrozen &&
          !freeze.raw.hodFrozen &&
          !freeze.raw.facultyFrozen
        );
      default:
        return false;
    }
  }

  switch (role) {
    case "admin":
      return (
        freeze.raw.adminFrozen ||
        freeze.raw.hodFrozen ||
        freeze.raw.facultyFrozen
      );
    case "hod":
    case "department":
      return freeze.raw.hodFrozen || freeze.raw.facultyFrozen;
    case "faculty":
      return false;
    default:
      return false;
  }
};

export const assertCanMutateAttendance = (
  role: Role,
  freeze: FreezeResolution
): void => {
  if (role === "admin") {
    throw new Error(forbidden("admin cannot mutate attendance"));
  }

  if (!canRoleMutateAttendance(role, freeze)) {
    if (freeze.raw.adminFrozen) {
      throw new Error(forbidden("locked by admin"));
    }
    if (freeze.raw.hodFrozen) {
      throw new Error(forbidden("frozen by HOD"));
    }
    if (freeze.raw.facultyFrozen) {
      throw new Error(forbidden("frozen by faculty"));
    }
    throw new Error(forbidden("insufficient permissions"));
  }
};

export const assertCanManageFreezeWindow = (
  role: Role,
  freeze: FreezeResolution,
  action: "freeze" | "unfreeze"
): void => {
  if (!canRoleManageFreezeWindow(role, freeze, action)) {
    if (action === "freeze") {
      if (freeze.raw.adminFrozen) {
        throw new Error(forbidden("locked by admin"));
      }
      if (freeze.raw.hodFrozen) {
        throw new Error(forbidden("frozen by HOD"));
      }
      if (freeze.raw.facultyFrozen) {
        throw new Error(forbidden("frozen by faculty"));
      }
    }

    if (action === "unfreeze") {
      if (role === "faculty") {
        throw new Error(forbidden("faculty cannot unfreeze attendance"));
      }
      if (
        (role === "department" || role === "hod") &&
        !freeze.raw.hodFrozen &&
        !freeze.raw.facultyFrozen
      ) {
        if (freeze.raw.adminFrozen) {
          throw new Error(forbidden("locked by admin"));
        }
        throw new Error(forbidden("HOD freeze not active"));
      }
    }

    throw new Error(forbidden("insufficient permissions"));
  }
};

export type FreezeWindowRow = {
  courseAssignmentId: string | null;
  electiveBatchFacultyId: string | null;
  isElective: boolean;
  domain: "section" | "group";
  courseCode: string;
  courseName: string;
  department: string;
  facultyName: string;
  semester: number;
  sectionId: string;
  sectionName: string;
  batchName: string | null;
  assignmentType: string;
  freeze: FreezeResolution;
};

export const ensureFreezeRow = async (
  courseAssignmentId: string
): Promise<Freeze> => {
  return db.freeze.upsert({
    where: { courseAssignmentId },
    create: { courseAssignmentId },
    update: {},
  });
};

export const ensureFreezeRowTx = async (
  tx: { freeze: { upsert: typeof db.freeze.upsert } },
  courseAssignmentId: string
): Promise<Freeze> => {
  return tx.freeze.upsert({
    where: { courseAssignmentId },
    create: { courseAssignmentId },
    update: {},
  });
};

export const assertFreezeOwnership = (input: {
  courseAssignmentId?: string | null;
  electiveBatchFacultyId?: string | null;
}): void => {
  const hasPc = Boolean(input.courseAssignmentId);
  const hasElective = Boolean(input.electiveBatchFacultyId);
  if (hasPc === hasElective) {
    throw new Error(
      "Freeze must reference exactly one ownership path (courseAssignmentId XOR electiveBatchFacultyId)."
    );
  }
};

type BulkFreezeTarget = {
  courseAssignmentId?: string | null;
  electiveBatchFacultyId?: string | null;
};

export class FreezeService {
  static async getFreezeForCourseAssignment(
    courseAssignmentId: string
  ): Promise<Freeze | null> {
    return db.freeze.findUnique({ where: { courseAssignmentId } });
  }

  static async getFreezeState(
    courseAssignmentId: string
  ): Promise<FreezeResolution> {
    const freeze = await this.getFreezeForCourseAssignment(courseAssignmentId);
    return resolveFreezeState(freeze);
  }

  static async getFacultyWindows(
    facultyId: string,
    semesterId: string
  ): Promise<FreezeWindowRow[]> {
    const [assignments, electiveAssignments] = await Promise.all([
      db.courseAssignment.findMany({
        where: {
          facultyId,
          section: { semesterId },
        },
        include: {
          course: { select: { code: true, name: true } },
          department: { select: { name: true } },
          faculty: { select: { shortName: true } },
          section: { select: { id: true, name: true } },
          batch: { select: { name: true } },
          freezes: true,
        },
      }),
      db.electiveBatchFaculty.findMany({
        where: {
          facultyId,
          course: { approvalStatus: FACULTY_COURSE_STATUS, semesterId },
        },
        include: {
          course: {
            select: {
              code: true,
              name: true,
              department: { select: { name: true } },
            },
          },
          faculty: { select: { shortName: true } },
          electiveBatch: { select: { id: true, name: true } },
          freeze: true,
        },
      }),
    ]);

    const pcRows = assignments.map((assignment) => ({
      courseAssignmentId: assignment.id,
      electiveBatchFacultyId: null,
      isElective: false,
      domain: "section" as const,
      courseCode: assignment.course.code,
      courseName: assignment.course.name,
      department: assignment.department.name,
      facultyName: assignment.faculty.shortName,
      semester: assignment.semester,
      sectionId: assignment.section.id,
      sectionName: assignment.section.name,
      batchName: assignment.batch?.name ?? null,
      assignmentType: assignment.assignmentType,
      freeze: resolveFreezeState(assignment.freezes),
    }));

    const electiveRows = electiveAssignments.map((assignment) => ({
      courseAssignmentId: null,
      electiveBatchFacultyId: assignment.id,
      isElective: true,
      domain: "group" as const,
      courseCode: assignment.course.code,
      courseName: assignment.course.name,
      department: assignment.course.department?.name ?? "",
      facultyName: assignment.faculty.shortName,
      semester: assignment.semester,
      sectionId: assignment.electiveBatch.id,
      sectionName: assignment.electiveBatch.name,
      batchName: null,
      assignmentType: "THEORY",
      freeze: resolveFreezeState(assignment.freeze),
    }));

    return [...pcRows, ...electiveRows];
  }

  static async getFacultyAssignments(
    facultyId: string,
    filters: { semester?: number }
  ): Promise<FreezeWindowRow[]> {
    const assignments = await db.courseAssignment.findMany({
      where: {
        facultyId,
        ...(filters.semester ? { semester: filters.semester } : {}),
      },
      include: {
        course: { select: { code: true, name: true } },
        department: { select: { name: true } },
        faculty: { select: { shortName: true } },
        section: { select: { id: true, name: true } },
        batch: { select: { name: true } },
        freezes: true,
      },
    });

    return assignments.map((assignment) => ({
      courseAssignmentId: assignment.id,
      electiveBatchFacultyId: null,
      isElective: false,
      domain: "section" as const,
      courseCode: assignment.course.code,
      courseName: assignment.course.name,
      department: assignment.department.name,
      facultyName: assignment.faculty.shortName,
      semester: assignment.semester,
      sectionId: assignment.section.id,
      sectionName: assignment.section.name,
      batchName: assignment.batch?.name ?? null,
      assignmentType: assignment.assignmentType,
      freeze: resolveFreezeState(assignment.freezes),
    }));
  }

  static async getDepartmentWindows(
    departmentId: string | undefined,
    semesterId: string
  ): Promise<FreezeWindowRow[]> {
    const where: Prisma.CourseAssignmentWhereInput = {
      ...(departmentId ? { departmentId } : {}),
      section: { semesterId },
    };
    const [assignments, electiveAssignments] = await Promise.all([
      db.courseAssignment.findMany({
        where,
        include: {
          course: { select: { code: true, name: true } },
          faculty: { select: { shortName: true } },
          department: { select: { name: true } },
          section: { select: { id: true, name: true } },
          batch: { select: { name: true } },
          freezes: true,
        },
      }),
      db.electiveBatchFaculty.findMany({
        where: {
          ...(departmentId ? { course: { departmentId } } : {}),
          course: { approvalStatus: FACULTY_COURSE_STATUS, semesterId },
        },
        include: {
          course: {
            select: {
              code: true,
              name: true,
              department: { select: { name: true } },
            },
          },
          faculty: { select: { shortName: true } },
          electiveBatch: { select: { id: true, name: true } },
          freeze: true,
        },
      }),
    ]);

    const pcRows = assignments.map((assignment) => ({
      courseAssignmentId: assignment.id,
      electiveBatchFacultyId: null,
      isElective: false,
      domain: "section" as const,
      courseCode: assignment.course.code,
      courseName: assignment.course.name,
      department: assignment.department.name,
      facultyName: assignment.faculty.shortName,
      semester: assignment.semester,
      sectionId: assignment.section.id,
      sectionName: assignment.section.name,
      batchName: assignment.batch?.name ?? null,
      assignmentType: assignment.assignmentType,
      freeze: resolveFreezeState(assignment.freezes),
    }));

    const electiveRows = electiveAssignments.map((assignment) => ({
      courseAssignmentId: null,
      electiveBatchFacultyId: assignment.id,
      isElective: true,
      domain: "group" as const,
      courseCode: assignment.course.code,
      courseName: assignment.course.name,
      department: assignment.course.department?.name ?? "",
      facultyName: assignment.faculty.shortName,
      semester: assignment.semester,
      sectionId: assignment.electiveBatch.id,
      sectionName: assignment.electiveBatch.name,
      batchName: null,
      assignmentType: "THEORY",
      freeze: resolveFreezeState(assignment.freeze),
    }));

    return [...pcRows, ...electiveRows];
  }

  private static buildFreezeUpdateData(
    role: Role,
    username?: string | null,
    displayUsername?: string | null
  ): Partial<Freeze> {
    const updateData: Partial<Freeze> = {};
    if (role === "faculty") {
      updateData.facultyFrozen = true;
      updateData.facultyFrozenAt = new Date();
    } else if (role === "department" || role === "hod") {
      updateData.hodFrozen = true;
      updateData.hodFrozenAt = new Date();
    } else if (role === "admin") {
      updateData.adminFrozen = true;
      updateData.adminFrozenAt = new Date();
    } else {
      throw new Error(forbidden("invalid role for freeze"));
    }

    const resolveRole = (r: Role): FreezeActorRole | null => {
      if (r === "faculty") return "FACULTY";
      if (r === "department" || r === "hod") return "HOD";
      if (r === "admin") return "ADMIN";
      return null;
    };

    updateData.frozenByRole = resolveRole(role);
    updateData.frozenByUsername = username ?? null;
    updateData.frozenByDisplay = displayUsername ?? null;

    return updateData;
  }

  private static buildUnfreezeUpdateData(role: Role): Partial<Freeze> {
    const updateData: Partial<Freeze> = {};
    if (role === "department" || role === "hod") {
      updateData.hodFrozen = false;
      updateData.hodFrozenAt = null;
      updateData.facultyFrozen = false;
      updateData.facultyFrozenAt = null;
      updateData.frozenByRole = null;
      updateData.frozenByUsername = null;
      updateData.frozenByDisplay = null;
    } else if (role === "admin") {
      updateData.adminFrozen = false;
      updateData.adminFrozenAt = null;
      updateData.hodFrozen = false;
      updateData.hodFrozenAt = null;
      updateData.facultyFrozen = false;
      updateData.facultyFrozenAt = null;
      updateData.frozenByRole = null;
      updateData.frozenByUsername = null;
      updateData.frozenByDisplay = null;
    } else {
      throw new Error(forbidden("invalid role for unfreeze"));
    }
    return updateData;
  }

  static async freeze(
    input: {
      courseAssignmentId?: string | null;
      electiveBatchFacultyId?: string | null;
    },
    role: Role,
    username?: string | null,
    displayUsername?: string | null
  ): Promise<FreezeResolution> {
    assertFreezeOwnership(input);
    const updateData = this.buildFreezeUpdateData(
      role,
      username,
      displayUsername
    );

    if (input.electiveBatchFacultyId) {
      const electiveAssignment = await db.electiveBatchFaculty.findUnique({
        where: { id: input.electiveBatchFacultyId },
        select: {
          id: true,
          courseId: true,
          course: { select: { approvalStatus: true } },
        },
      });
      if (!electiveAssignment) {
        throw new Error(notFound("Elective batch faculty assignment"));
      }
      if (electiveAssignment.course.approvalStatus !== FACULTY_COURSE_STATUS) {
        throw new Error(forbidden("course is not approved for freezing"));
      }

      const result = await db.$transaction(async (tx) => {
        const freeze = await tx.freeze.findUnique({
          where: { electiveBatchFacultyId: electiveAssignment.id },
        });
        const resolution = resolveFreezeState(freeze);
        assertCanManageFreezeWindow(role, resolution, "freeze");

        const updated = await tx.freeze.upsert({
          where: { electiveBatchFacultyId: electiveAssignment.id },
          create: {
            electiveBatchFacultyId: electiveAssignment.id,
            ...updateData,
          },
          update: updateData,
        });

        return resolveFreezeState(updated);
      });

      await recomputeCourseMarks(electiveAssignment.courseId);

      return result;
    }

    const courseAssignmentId = input.courseAssignmentId ?? "";
    const assignment = await db.courseAssignment.findUnique({
      where: { id: courseAssignmentId },
      select: { id: true, courseId: true },
    });
    if (!assignment) {
      throw new Error(notFound("Course assignment"));
    }

    const result = await db.$transaction(async (tx) => {
      const freeze = await tx.freeze.findUnique({
        where: { courseAssignmentId },
      });
      const resolution = resolveFreezeState(freeze);
      assertCanManageFreezeWindow(role, resolution, "freeze");

      const updated = await tx.freeze.upsert({
        where: { courseAssignmentId },
        create: {
          courseAssignmentId,
          ...updateData,
        },
        update: updateData,
      });

      return resolveFreezeState(updated);
    });

    await recomputeCourseMarks(assignment.courseId);

    return result;
  }

  static async unfreeze(
    input: {
      courseAssignmentId?: string | null;
      electiveBatchFacultyId?: string | null;
    },
    role: Role
  ): Promise<FreezeResolution> {
    assertFreezeOwnership(input);
    const updateData = this.buildUnfreezeUpdateData(role);

    if (input.electiveBatchFacultyId) {
      const electiveAssignment = await db.electiveBatchFaculty.findUnique({
        where: { id: input.electiveBatchFacultyId },
        select: { id: true },
      });
      if (!electiveAssignment) {
        throw new Error(notFound("Elective batch faculty assignment"));
      }

      return db.$transaction(async (tx) => {
        const freeze = await tx.freeze.findUnique({
          where: { electiveBatchFacultyId: electiveAssignment.id },
        });
        const resolution = resolveFreezeState(freeze);
        assertCanManageFreezeWindow(role, resolution, "unfreeze");

        const updated = await tx.freeze.upsert({
          where: { electiveBatchFacultyId: electiveAssignment.id },
          create: {
            electiveBatchFacultyId: electiveAssignment.id,
            ...updateData,
          },
          update: updateData,
        });

        return resolveFreezeState(updated);
      });
    }

    const courseAssignmentId = input.courseAssignmentId ?? "";
    const assignment = await db.courseAssignment.findUnique({
      where: { id: courseAssignmentId },
      select: { id: true },
    });
    if (!assignment) {
      throw new Error(notFound("Course assignment"));
    }

    return db.$transaction(async (tx) => {
      const freeze = await tx.freeze.findUnique({
        where: { courseAssignmentId },
      });
      const resolution = resolveFreezeState(freeze);
      assertCanManageFreezeWindow(role, resolution, "unfreeze");

      const updated = await tx.freeze.upsert({
        where: { courseAssignmentId },
        create: {
          courseAssignmentId,
          ...updateData,
        },
        update: updateData,
      });

      return resolveFreezeState(updated);
    });
  }

  static async bulkFreeze(
    departmentId: string | undefined,
    semesterId: string,
    targets: BulkFreezeTarget[],
    username?: string | null,
    displayUsername?: string | null
  ): Promise<number> {
    const result = await db.$transaction(async (tx) => {
      const courseIds = new Set<string>();
      let processed = 0;

      for (const target of targets) {
        if (target.courseAssignmentId) {
          const assignment = await tx.courseAssignment.findFirst({
            where: {
              id: target.courseAssignmentId,
              ...(departmentId ? { departmentId } : {}),
              section: { semesterId },
            },
            select: { id: true, courseId: true },
          });
          if (!assignment) continue;

          await tx.freeze.upsert({
            where: { courseAssignmentId: assignment.id },
            create: {
              courseAssignmentId: assignment.id,
              adminFrozen: true,
              adminFrozenAt: new Date(),
              frozenByRole: "ADMIN",
              frozenByUsername: username ?? null,
              frozenByDisplay: displayUsername ?? null,
            },
            update: {
              adminFrozen: true,
              adminFrozenAt: new Date(),
              frozenByRole: "ADMIN",
              frozenByUsername: username ?? null,
              frozenByDisplay: displayUsername ?? null,
            },
          });
          courseIds.add(assignment.courseId);
          processed++;
          continue;
        }

        if (target.electiveBatchFacultyId) {
          const assignment = await tx.electiveBatchFaculty.findFirst({
            where: {
              id: target.electiveBatchFacultyId,
              course: {
                semesterId,
                approvalStatus: FACULTY_COURSE_STATUS,
                ...(departmentId ? { departmentId } : {}),
              },
            },
            select: { id: true, courseId: true },
          });
          if (!assignment) continue;

          await tx.freeze.upsert({
            where: { electiveBatchFacultyId: assignment.id },
            create: {
              electiveBatchFacultyId: assignment.id,
              adminFrozen: true,
              adminFrozenAt: new Date(),
              frozenByRole: "ADMIN",
              frozenByUsername: username ?? null,
              frozenByDisplay: displayUsername ?? null,
            },
            update: {
              adminFrozen: true,
              adminFrozenAt: new Date(),
              frozenByRole: "ADMIN",
              frozenByUsername: username ?? null,
              frozenByDisplay: displayUsername ?? null,
            },
          });
          courseIds.add(assignment.courseId);
          processed++;
        }
      }

      return { courseIds: [...courseIds], processed };
    });

    for (const courseId of result.courseIds) {
      await recomputeCourseMarks(courseId);
    }

    return result.processed;
  }

  static async bulkUnfreeze(
    departmentId: string | undefined,
    semesterId: string,
    targets: BulkFreezeTarget[]
  ): Promise<number> {
    return db.$transaction(async (tx) => {
      let processed = 0;
      const updateData = {
        adminFrozen: false,
        adminFrozenAt: null,
        hodFrozen: false,
        hodFrozenAt: null,
        facultyFrozen: false,
        facultyFrozenAt: null,
        frozenByRole: null,
        frozenByUsername: null,
        frozenByDisplay: null,
      };

      for (const target of targets) {
        if (target.courseAssignmentId) {
          const assignment = await tx.courseAssignment.findFirst({
            where: {
              id: target.courseAssignmentId,
              ...(departmentId ? { departmentId } : {}),
              section: { semesterId },
            },
            select: { id: true },
          });
          if (!assignment) continue;

          await tx.freeze.upsert({
            where: { courseAssignmentId: assignment.id },
            create: { courseAssignmentId: assignment.id },
            update: updateData,
          });
          processed++;
          continue;
        }

        if (target.electiveBatchFacultyId) {
          const assignment = await tx.electiveBatchFaculty.findFirst({
            where: {
              id: target.electiveBatchFacultyId,
              course: {
                semesterId,
                approvalStatus: FACULTY_COURSE_STATUS,
                ...(departmentId ? { departmentId } : {}),
              },
            },
            select: { id: true },
          });
          if (!assignment) continue;

          await tx.freeze.upsert({
            where: { electiveBatchFacultyId: assignment.id },
            create: { electiveBatchFacultyId: assignment.id },
            update: updateData,
          });
          processed++;
        }
      }

      return processed;
    });
  }
}
