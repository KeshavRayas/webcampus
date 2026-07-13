import { db } from "@webcampus/db";
import type { Prisma } from "@webcampus/db";

export type CourseAssignmentFilters = {
  departmentId?: string;
  semesterId?: string;
  sectionId?: string;
  courseIds?: string[];
  /**
   * When set to `null`, restricts results to THEORY assignments (batchId IS NULL).
   * When set to a string, restricts to the specific batch.
   * When omitted (undefined), no batchId filter is applied.
   */
  batchId?: string | null;
};

export function buildCourseAssignmentWhere(
  filters: CourseAssignmentFilters
): Prisma.CourseAssignmentWhereInput {
  const where: Prisma.CourseAssignmentWhereInput = {};

  if (filters.semesterId) {
    where.section = { semesterId: filters.semesterId };
  }
  if (filters.sectionId) {
    where.sectionId = filters.sectionId;
  }
  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }
  if (filters.courseIds && filters.courseIds.length > 0) {
    where.courseId = { in: filters.courseIds };
  }
  if (filters.batchId !== undefined) {
    where.batchId = filters.batchId;
  }

  return where;
}

export type CourseAssignmentWithFreeze = {
  id: string;
  courseId: string;
  sectionId: string;
  freezes: {
    facultyFrozen: boolean;
    hodFrozen: boolean;
    adminFrozen: boolean;
  } | null;
};

export async function findCourseAssignments(
  filters: CourseAssignmentFilters
): Promise<CourseAssignmentWithFreeze[]> {
  return db.courseAssignment.findMany({
    where: buildCourseAssignmentWhere(filters),
    select: {
      id: true,
      courseId: true,
      sectionId: true,
      freezes: {
        select: {
          facultyFrozen: true,
          hodFrozen: true,
          adminFrozen: true,
        },
      },
    },
  });
}
