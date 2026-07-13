import { db } from "@webcampus/db";
import type { Freeze, FreezeActorRole, Prisma } from "@webcampus/db";
import type { FreezeDisplayState } from "@webcampus/schemas/faculty";
import type { Role } from "@webcampus/types/rbac";
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
  courseAssignmentId: string;
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
    const assignments = await db.courseAssignment.findMany({
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
    });

    return assignments.map((assignment) => ({
      courseAssignmentId: assignment.id,
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
    const assignments = await db.courseAssignment.findMany({
      where,
      include: {
        course: { select: { code: true, name: true } },
        faculty: { select: { shortName: true } },
        department: { select: { name: true } },
        section: { select: { id: true, name: true } },
        batch: { select: { name: true } },
        freezes: true,
      },
    });

    return assignments.map((assignment) => ({
      courseAssignmentId: assignment.id,
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

  static async freeze(
    courseAssignmentId: string,
    role: Role,
    username?: string | null,
    displayUsername?: string | null
  ): Promise<FreezeResolution> {
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
    courseAssignmentId: string,
    role: Role
  ): Promise<FreezeResolution> {
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
    username?: string | null,
    displayUsername?: string | null
  ): Promise<number> {
    const count = await db.$transaction(async (tx) => {
      const where: Prisma.CourseAssignmentWhereInput = {
        ...(departmentId ? { departmentId } : {}),
        section: { semesterId },
      };
      const assignments = await tx.courseAssignment.findMany({
        where,
        select: { id: true, courseId: true },
      });

      // TODO: optimize with updateMany for large bulk operations
      for (const assignment of assignments) {
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
      }

      return assignments;
    });

    const courseIds = [...new Set(count.map((a) => a.courseId))];
    for (const courseId of courseIds) {
      await recomputeCourseMarks(courseId);
    }

    return count.length;
  }

  static async bulkUnfreeze(
    departmentId: string | undefined,
    semesterId: string
  ): Promise<number> {
    return db.$transaction(async (tx) => {
      const where: Prisma.CourseAssignmentWhereInput = {
        ...(departmentId ? { departmentId } : {}),
        section: { semesterId },
      };
      const assignments = await tx.courseAssignment.findMany({
        where,
        select: { id: true },
      });

      // TODO: optimize with updateMany for large bulk operations
      for (const assignment of assignments) {
        await tx.freeze.upsert({
          where: { courseAssignmentId: assignment.id },
          create: { courseAssignmentId: assignment.id },
          update: {
            adminFrozen: false,
            adminFrozenAt: null,
            hodFrozen: false,
            hodFrozenAt: null,
            facultyFrozen: false,
            facultyFrozenAt: null,
            frozenByRole: null,
            frozenByUsername: null,
            frozenByDisplay: null,
          },
        });
      }

      return assignments.length;
    });
  }
}
