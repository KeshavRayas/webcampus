import { logger } from "@webcampus/common/logger";
import { db, EligibilityStatus, Prisma } from "@webcampus/db";
import { buildAggregationResultsForStudents } from "./assessment-aggregation.loader";

export async function recomputeStudentMark(
  studentId: string,
  courseId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const prisma = tx ?? db;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { cieEligibility: true, code: true },
  });

  if (!course) {
    logger.warn(`[MarkSync] Course ${courseId} not found — skipping`);
    return;
  }

  const results = await buildAggregationResultsForStudents(courseId, [
    studentId,
  ]);
  const result = results.get(studentId);

  if (!result) {
    logger.warn(
      `[MarkSync] No aggregation result for student=${studentId} course=${course.code} — skipping`
    );
    return;
  }

  const cieTotal = result.cieTotal;
  const status: EligibilityStatus = result.status;

  await db.mark.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: { studentId, courseId, cieTotal, status },
    update: { cieTotal, status },
  });

  logger.info(
    `[MarkSync] student=${studentId} course=${course.code} cieTotal=${cieTotal} min=${course.seeEligibility} status=${status}`
  );
}

export async function recomputeCourseMarks(courseId: string): Promise<void> {
  const registrations = await db.courseRegistration.findMany({
    where: { courseId },
    select: { studentId: true },
  });

  if (registrations.length === 0) {
    logger.warn(`[MarkSync] No registrations found for course ${courseId}`);
    return;
  }

  for (const { studentId } of registrations) {
    await recomputeStudentMark(studentId, courseId);
  }

  logger.info(
    `[MarkSync] recomputed marks for ${registrations.length} students in course ${courseId}`
  );
}
