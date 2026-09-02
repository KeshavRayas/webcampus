import { logger } from "@webcampus/common/logger";
import { db, EligibilityStatus, Prisma } from "@webcampus/db";
import { buildAggregationResultsForStudents } from "./assessment-aggregation.loader";
import { PINNED_REGISTRATION_TYPES } from "./course-registration-resolver";

export type RecomputeMarkOptions = {
  semesterId?: string | null;
  courseRegistrationId?: string | null;
};

type SyncPrisma = Prisma.TransactionClient | typeof db;

type AggregationCourse = { cieEligibility: number; code: string };

async function loadSyncCourse(
  prisma: SyncPrisma,
  courseId: string
): Promise<AggregationCourse | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { cieEligibility: true, code: true },
  });
  return course ?? null;
}

function isP2002(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Attempt-scoped write: never touches a row pinned to a different attempt.
async function writeAttemptScopedMark(
  prisma: SyncPrisma,
  course: AggregationCourse,
  studentId: string,
  courseId: string,
  cieTotal: number | null,
  status: EligibilityStatus,
  courseRegistrationId: string | null
): Promise<void> {
  const pinnedRow = await prisma.mark.findFirst({
    where: {
      studentId,
      courseId,
      ...(courseRegistrationId
        ? { courseRegistrationId }
        : { courseRegistrationId: null }),
    },
    select: { id: true },
  });

  if (pinnedRow) {
    await prisma.mark.update({
      where: { id: pinnedRow.id },
      data: { cieTotal, status },
    });
  } else if (courseRegistrationId) {
    const created = await prisma.mark
      .create({
        data: { studentId, courseId, cieTotal, status, courseRegistrationId },
      })
      .catch((error: unknown) => {
        // Defensive only since M8: two attempts may legitimately hold rows,
        // but a concurrent duplicate insert can still race the unique index.
        if (isP2002(error)) {
          return null;
        }
        throw error;
      });
    if (!created) {
      logger.warn(
        `[MarkSync] Mark for student=${studentId} course=${course.code} is held by another attempt — left untouched`
      );
    }
  } else {
    const created = await prisma.mark
      .create({
        data: { studentId, courseId, cieTotal, status },
      })
      .catch((error: unknown) => {
        if (isP2002(error)) {
          return null;
        }
        throw error;
      });
    if (!created) {
      logger.warn(
        `[MarkSync] Legacy mark for student=${studentId} course=${course.code} already exists — left untouched`
      );
    }
  }

  logger.info(
    `[MarkSync] student=${studentId} course=${course.code} attempt=${courseRegistrationId ?? "legacy"} cieTotal=${cieTotal} min=${course.cieEligibility} status=${status}`
  );
}

export async function recomputeStudentMark(
  studentId: string,
  courseId: string,
  tx?: Prisma.TransactionClient,
  options?: RecomputeMarkOptions
): Promise<void> {
  const prisma = tx ?? db;
  const course = await loadSyncCourse(prisma, courseId);

  if (!course) {
    logger.warn(`[MarkSync] Course ${courseId} not found — skipping`);
    return;
  }

  const results = await buildAggregationResultsForStudents(
    courseId,
    [studentId],
    tx,
    {
      semesterId: options?.semesterId,
      ...(options?.courseRegistrationId
        ? {
            preferredRegistrationByStudent: new Map([
              [studentId, options.courseRegistrationId],
            ]),
          }
        : {}),
    }
  );
  const result = results.get(studentId);

  if (!result) {
    logger.warn(
      `[MarkSync] No aggregation result for student=${studentId} course=${course.code} — skipping`
    );
    return;
  }

  await writeAttemptScopedMark(
    prisma,
    course,
    studentId,
    courseId,
    result.cieTotal,
    result.status,
    options?.courseRegistrationId ?? null
  );
}

export async function recomputeCourseMarks(courseId: string): Promise<void> {
  const registrations = await db.courseRegistration.findMany({
    where: {
      courseId,
      status: "ACTIVE",
      registrationType: { in: [...PINNED_REGISTRATION_TYPES] },
    },
    select: { studentId: true, id: true, semesterId: true },
    orderBy: { registrationDate: "asc" },
  });

  if (registrations.length === 0) {
    logger.warn(`[MarkSync] No registrations found for course ${courseId}`);
    return;
  }

  const course = await loadSyncCourse(db, courseId);
  if (!course) {
    logger.warn(`[MarkSync] Course ${courseId} not found — skipping`);
    return;
  }

  const bySemester = new Map<string, typeof registrations>();
  const preferredRegistrationByStudent = new Map<string, string>();
  for (const registration of registrations) {
    const group = bySemester.get(registration.semesterId) ?? [];
    group.push(registration);
    bySemester.set(registration.semesterId, group);
    // Registrations arrive oldest-first; the newest attempt per student wins.
    preferredRegistrationByStudent.set(registration.studentId, registration.id);
  }

  let recomputed = 0;
  for (const [semesterId, semesterRegistrations] of bySemester) {
    const results = await buildAggregationResultsForStudents(
      courseId,
      semesterRegistrations.map((registration) => registration.studentId),
      undefined,
      { semesterId, preferredRegistrationByStudent }
    );

    for (const registration of semesterRegistrations) {
      const result = results.get(registration.studentId);
      if (!result) {
        logger.warn(
          `[MarkSync] No aggregation result for student=${registration.studentId} course=${course.code} — skipping`
        );
        continue;
      }

      await writeAttemptScopedMark(
        db,
        course,
        registration.studentId,
        courseId,
        result.cieTotal,
        result.status,
        registration.id
      );
      recomputed += 1;
    }
  }

  logger.info(
    `[MarkSync] recomputed marks for ${recomputed}/${registrations.length} registrations in course ${courseId}`
  );
}
