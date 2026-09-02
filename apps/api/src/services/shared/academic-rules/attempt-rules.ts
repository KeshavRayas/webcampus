import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
  PolicyProfile,
  RegistrationStatusValue,
  RuleWarning,
} from "./academic-rules.types";

export type AttemptCourseRegistration = {
  status: RegistrationStatusValue;
  registrationType: string;
};

export type AttemptExamRegistration = {
  status: ExamRegistrationStatusValue;
  outcome: CourseOutcomeValue;
  attemptNumber: number;
};

export type AttemptSummary = {
  attemptCount: number;
  nextAttemptNumber: number;
  warnings: RuleWarning[];
};

export function computeAttemptSummary(
  courseRegistrations: AttemptCourseRegistration[],
  examRegistrations: AttemptExamRegistration[],
  policy: Pick<
    PolicyProfile,
    "maxAttemptsBeforeAlternate" | "maxAttemptsTotal"
  > = {
    maxAttemptsBeforeAlternate: 4,
    maxAttemptsTotal: 5,
  }
): AttemptSummary {
  const countedRegistrations = courseRegistrations.filter(
    (r) => r.status !== "CANCELLED"
  ).length;

  const maxExamAttemptNumber = examRegistrations
    .filter((r) => r.status !== "CANCELLED")
    .reduce((max, r) => Math.max(max, r.attemptNumber), 0);

  const priorAttempts = Math.max(countedRegistrations, maxExamAttemptNumber);
  const nextAttemptNumber = priorAttempts + 1;

  const warnings: RuleWarning[] = [];
  if (priorAttempts >= policy.maxAttemptsBeforeAlternate) {
    warnings.push("ALTERNATE_PATHWAY_RECOMMENDED");
  }
  if (priorAttempts >= policy.maxAttemptsTotal) {
    warnings.push("ATTEMPT_LIMIT_WARNING");
  }

  return { attemptCount: priorAttempts, nextAttemptNumber, warnings };
}

export function getAttemptCount(
  courseRegistrations: AttemptCourseRegistration[],
  examRegistrations: AttemptExamRegistration[]
): number {
  return computeAttemptSummary(courseRegistrations, examRegistrations)
    .attemptCount;
}
