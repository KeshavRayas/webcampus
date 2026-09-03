import { db } from "@webcampus/db";
import type { Prisma } from "@webcampus/db";

export const PINNED_REGISTRATION_TYPES = [
  "REGULAR",
  "RE_REGISTRATION",
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
 * Dev-compatible resolver: CourseRegistration on dev has no status/registrationType.
 * Falls back to filtering only by courseId, studentId, semesterId, academicTermId.
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
      ...(input.academicTermId ? { academicTermId: input.academicTermId } : {}),
      ...(input.semesterId ? { semesterId: input.semesterId } : {}),
    },
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      academicTermId: true,
    },
  });

  if (!registration) return null;
  return {
    id: registration.id,
    academicTermId: registration.academicTermId,
    registrationType: "REGULAR",
  };
}

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
      ...(input.academicTermId ? { academicTermId: input.academicTermId } : {}),
      ...(input.semesterId ? { semesterId: input.semesterId } : {}),
    },
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      studentId: true,
      academicTermId: true,
    },
  });

  for (const registration of registrations) {
    if (!resolved.has(registration.studentId)) {
      resolved.set(registration.studentId, {
        id: registration.id,
        academicTermId: registration.academicTermId,
        registrationType: "REGULAR",
      });
    }
  }

  return resolved;
}
