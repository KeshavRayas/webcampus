import type { Prisma } from "@webcampus/db";
import { PINNED_REGISTRATION_TYPES } from "./course-registration-resolver";

export type RegistrationFilterOptions = {
  courseId: string;
  semesterId: string;
  sectionId?: string;
  batchId?: string;
};

/**
 * Roster predicate for a course offering: ACTIVE pinned-type registrations
 * of the course's home semester. Deliberately NOT term-anchored —
 * cross-term re-registration rows carry the current academicTermId while
 * keeping the course-home semesterId, and the chain invariant (one ACTIVE
 * row per student x course) already guarantees exactly-once rosters.
 */
export function buildRegistrationWhere(
  options: RegistrationFilterOptions
): Prisma.CourseRegistrationWhereInput {
  const where: Prisma.CourseRegistrationWhereInput = {
    courseId: options.courseId,
    semesterId: options.semesterId,
    status: "ACTIVE",
    registrationType: { in: [...PINNED_REGISTRATION_TYPES] },
  };

  if (options.sectionId || options.batchId) {
    where.student = {};

    if (options.sectionId) {
      where.student.studentSections = {
        some: { sectionId: options.sectionId },
      };
    }

    if (options.batchId) {
      where.student.batches = {
        some: { id: options.batchId },
      };
    }
  }

  return where;
}
