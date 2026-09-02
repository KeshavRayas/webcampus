import { db } from "@webcampus/db";
import type { Prisma } from "@webcampus/db";

export const PINNED_REGISTRATION_TYPES = [
  "REGULAR",
  "RE_REGISTRATION",
  "SUPPLEMENTARY",
] as const;

export const REGULAR_ATTEMPT_REGISTRATION_TYPES = [
  "REGULAR",
  "RE_REGISTRATION",
] as const;

export type ResolveActiveRegistrationInput = {
  studentId: string;
  courseId: string;
  academicTermId?: string | null;
  semesterId?: string | null;
};

export type ResolvedActiveRegistration = {
  id: string;
  academicTermId: string;
  registrationType: string;
};

/**
 * Resolves the CourseRegistration an attendance/CIE write belongs to.
 * When academicTermId is known (assignment/template/session anchor), only
 * registrations of that term are considered. Without an anchor (e.g.
 * section-less PE sessions) the most recent pinned-type registration wins —
 * recency fallback, documented in the implementation plan (K1).
 */
export async function resolveActiveRegistration(
  input: ResolveActiveRegistrationInput,
  tx?: Prisma.TransactionClient
): Promise<ResolvedActiveRegistration | null> {
  const prisma = tx ?? db;
  const registration = await prisma.courseRegistration.findFirst({
    where: {
      studentId: input.studentId,
      courseId: input.courseId,
      status: "ACTIVE",
      registrationType: { in: [...PINNED_REGISTRATION_TYPES] },
      ...(input.academicTermId ? { academicTermId: input.academicTermId } : {}),
      ...(input.semesterId ? { semesterId: input.semesterId } : {}),
    },
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      academicTermId: true,
      registrationType: true,
    },
  });

  return registration ?? null;
}

/**
 * Batched variant of resolveActiveRegistration for one course across many
 * students (hot-path marks/attendance loops). Same pinned-type + ACTIVE
 * semantics; recency tie-break per student. Missing students simply have no
 * entry in the returned map.
 */
export async function resolveActiveRegistrationsForCourse(
  input: {
    courseId: string;
    studentIds: string[];
    academicTermId?: string | null;
    semesterId?: string | null;
  },
  tx?: Prisma.TransactionClient
): Promise<Map<string, ResolvedActiveRegistration>> {
  const resolved = new Map<string, ResolvedActiveRegistration>();
  if (input.studentIds.length === 0) {
    return resolved;
  }

  const prisma = tx ?? db;
  const registrations = await prisma.courseRegistration.findMany({
    where: {
      courseId: input.courseId,
      studentId: { in: input.studentIds },
      status: "ACTIVE",
      registrationType: { in: [...PINNED_REGISTRATION_TYPES] },
      ...(input.academicTermId ? { academicTermId: input.academicTermId } : {}),
      ...(input.semesterId ? { semesterId: input.semesterId } : {}),
    },
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      studentId: true,
      academicTermId: true,
      registrationType: true,
    },
  });

  for (const registration of registrations) {
    if (!resolved.has(registration.studentId)) {
      resolved.set(registration.studentId, {
        id: registration.id,
        academicTermId: registration.academicTermId,
        registrationType: registration.registrationType,
      });
    }
  }

  return resolved;
}
