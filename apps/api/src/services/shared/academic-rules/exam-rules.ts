import {
  allow,
  deny,
  type CourseOutcomeValue,
  type ExamRegistrationStatusValue,
  type RuleVerdict,
} from "./academic-rules.types";

export type SeeEligibilityInput = {
  hasActiveRegistration: boolean;
  cieEligible: boolean;
  latestExamStatus?: ExamRegistrationStatusValue | null;
  latestExamOutcome?: CourseOutcomeValue | null;
  hasFreshRegistrationAfterNE?: boolean;
};

export function canTakeSEE(input: SeeEligibilityInput): RuleVerdict {
  if (!input.hasActiveRegistration) {
    return deny(["NO_ACTIVE_REGISTRATION"]);
  }
  const supersedesStaleNE =
    input.latestExamOutcome === "NE" &&
    input.hasFreshRegistrationAfterNE === true;
  if (input.latestExamOutcome === "NE" && !supersedesStaleNE) {
    return deny(["SEE_BLOCKED_NOT_ELIGIBLE"]);
  }
  if (
    !supersedesStaleNE &&
    input.latestExamStatus != null &&
    input.latestExamStatus !== "REGISTERED" &&
    input.latestExamStatus !== "SEATED"
  ) {
    return deny(["ATTEMPT_ALREADY_CONCLUDED"]);
  }
  if (!input.cieEligible) {
    return deny(["CIE_NOT_ELIGIBLE"]);
  }
  return allow();
}

export function deriveLatestOutcome(
  examRegistrations: Array<{
    status: ExamRegistrationStatusValue;
    outcome: CourseOutcomeValue;
    registeredAt: Date;
  }>
): {
  status: ExamRegistrationStatusValue | null;
  outcome: CourseOutcomeValue | null;
} {
  const active = examRegistrations.filter((r) => r.status !== "CANCELLED");
  if (active.length === 0) {
    return { status: null, outcome: null };
  }

  const sorted = [...active].sort(
    (a, b) => a.registeredAt.getTime() - b.registeredAt.getTime()
  );

  const newest = sorted.at(-1);
  if (!newest) {
    return { status: null, outcome: null };
  }
  if (newest.status === "RESULT_DECLARED") {
    return { status: newest.status, outcome: newest.outcome };
  }
  return { status: newest.status, outcome: "PENDING" };
}
