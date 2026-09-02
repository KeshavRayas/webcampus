import { db, Prisma } from "@webcampus/db";
import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
  RegistrationStatusValue,
} from "./academic-rules.types";
import { computeAttemptSummary, type AttemptSummary } from "./attempt-rules";
import { deriveLatestOutcome } from "./exam-rules";

export type CourseAttemptHistory = AttemptSummary & {
  latestExamStatus: ExamRegistrationStatusValue | null;
  latestOutcome: CourseOutcomeValue | null;
};

export async function getCourseAttemptHistory(
  studentId: string,
  courseId: string,
  tx?: Prisma.TransactionClient
): Promise<CourseAttemptHistory> {
  const prisma = tx ?? db;

  const [registrations, examRegistrations] = await Promise.all([
    prisma.courseRegistration.findMany({
      where: { studentId, courseId },
      select: { status: true, registrationType: true },
    }),
    prisma.examRegistration.findMany({
      where: { studentId, courseId },
      select: {
        status: true,
        outcome: true,
        attemptNumber: true,
        registeredAt: true,
      },
    }),
  ]);

  const summary = computeAttemptSummary(
    registrations.map((r) => ({
      status: r.status as RegistrationStatusValue,
      registrationType: r.registrationType,
    })),
    examRegistrations.map((r) => ({
      status: r.status as ExamRegistrationStatusValue,
      outcome: r.outcome as CourseOutcomeValue,
      attemptNumber: r.attemptNumber,
    }))
  );

  const latest = deriveLatestOutcome(
    examRegistrations.map((r) => ({
      status: r.status as ExamRegistrationStatusValue,
      outcome: r.outcome as CourseOutcomeValue,
      registeredAt: r.registeredAt,
    }))
  );

  return {
    ...summary,
    latestExamStatus: latest.status,
    latestOutcome: latest.outcome,
  };
}
