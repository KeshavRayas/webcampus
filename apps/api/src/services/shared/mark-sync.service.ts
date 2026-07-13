import { logger } from "@webcampus/common/logger";
import { db, EligibilityStatus } from "@webcampus/db";

export async function recomputeStudentMark(
  studentId: string,
  courseId: string
): Promise<void> {
  const [assessments, course] = await Promise.all([
    db.studentAssessment.findMany({
      where: { studentId, courseId },
      select: { totalMarks: true },
    }),
    db.course.findUnique({
      where: { id: courseId },
      select: { cumulativeMinMarks: true, code: true },
    }),
  ]);

  if (!course) {
    logger.warn(`[MarkSync] Course ${courseId} not found — skipping`);
    return;
  }

  const cieTotal = assessments.reduce((sum, a) => sum + a.totalMarks, 0);
  const status: EligibilityStatus =
    cieTotal >= course.cumulativeMinMarks ? "ELIGIBLE" : "NOT_ELIGIBLE";

  await db.mark.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: { studentId, courseId, cieTotal, status },
    update: { cieTotal, status },
  });

  logger.info(
    `[MarkSync] student=${studentId} course=${course.code} cieTotal=${cieTotal} min=${course.cumulativeMinMarks} status=${status}`
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
