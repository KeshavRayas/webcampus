import {
  allow,
  deny,
  type CourseOutcomeValue,
  type RegistrationTypeValue,
  type RuleDenialReason,
  type RuleVerdict,
  type RuleWarning,
} from "./academic-rules.types";

export type RegistrationPathway = {
  reRegisterAllowed: boolean;
  supplementaryRegistrationAllowed: boolean;
  reappearExamAllowed: boolean;
};

export function resolveRegistrationPathway(
  outcome: CourseOutcomeValue,
  wasEligibleAtRegistration: boolean
): RegistrationPathway {
  switch (outcome) {
    case "P":
    case "PENDING":
    case "I":
      return {
        reRegisterAllowed: false,
        supplementaryRegistrationAllowed: false,
        reappearExamAllowed: false,
      };
    case "F":
      return {
        reRegisterAllowed: false,
        supplementaryRegistrationAllowed: false,
        reappearExamAllowed: true,
      };
    case "X":
      return wasEligibleAtRegistration
        ? {
            reRegisterAllowed: false,
            supplementaryRegistrationAllowed: false,
            reappearExamAllowed: true,
          }
        : {
            reRegisterAllowed: true,
            supplementaryRegistrationAllowed: true,
            reappearExamAllowed: false,
          };
    case "NE":
    case "W":
      return {
        reRegisterAllowed: true,
        supplementaryRegistrationAllowed: true,
        reappearExamAllowed: false,
      };
  }
}

export function canReRegister(
  outcome: CourseOutcomeValue,
  wasEligibleAtRegistration = true
): RuleVerdict {
  const pathway = resolveRegistrationPathway(
    outcome,
    wasEligibleAtRegistration
  );
  if (pathway.reRegisterAllowed) {
    return allow();
  }
  return deny([blockingReasonForOutcome(outcome, wasEligibleAtRegistration)]);
}

export function canRegisterSupplementaryCourse(
  outcome: CourseOutcomeValue,
  wasEligibleAtRegistration = true
): RuleVerdict {
  const pathway = resolveRegistrationPathway(
    outcome,
    wasEligibleAtRegistration
  );
  if (pathway.supplementaryRegistrationAllowed) {
    return allow();
  }
  return deny([blockingReasonForOutcome(outcome, wasEligibleAtRegistration)]);
}

function blockingReasonForOutcome(
  outcome: CourseOutcomeValue,
  wasEligibleAtRegistration: boolean
): RuleDenialReason {
  if (outcome === "P") {
    return "OUTCOME_PASSED";
  }
  if (outcome === "PENDING") {
    return "ATTEMPT_IN_PROGRESS";
  }
  if (outcome === "I") {
    return "RESULT_INCOMPLETE";
  }
  if (outcome === "F" || (outcome === "X" && wasEligibleAtRegistration)) {
    return "REAPPEAR_ONLY";
  }
  return "NEEDS_FRESH_REGISTRATION";
}

export function canReappearForExam(
  outcome: CourseOutcomeValue,
  wasEligibleAtRegistration: boolean
): RuleVerdict {
  const pathway = resolveRegistrationPathway(
    outcome,
    wasEligibleAtRegistration
  );
  if (pathway.reappearExamAllowed) {
    return allow();
  }
  return deny([blockingReasonForOutcome(outcome, wasEligibleAtRegistration)]);
}

export type WindowScope = {
  academicTermId: string;
  semesterId: string;
  departmentId?: string | null;
  cycle?: string | null;
};

export type RegistrationWindowCandidate = {
  id: string;
  departmentId: string | null;
  cycle: string | null;
  registrationType: string;
  isOpen: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type WindowEvaluation = {
  open: boolean;
  reason?: RuleDenialReason;
  warnings: RuleWarning[];
  windowId?: string;
  registrationType?: RegistrationTypeValue;
};

export function evaluateRegistrationWindow(
  registrationType: RegistrationTypeValue,
  scope: Omit<WindowScope, "registrationType">,
  candidates: RegistrationWindowCandidate[],
  now: Date
): WindowEvaluation {
  const matching = candidates.filter(
    (w) => w.registrationType === registrationType
  );

  const specific = pickMostSpecific(
    matching,
    scope.departmentId ?? null,
    scope.cycle ?? null
  );
  if (!specific) {
    return { open: false, reason: "NO_WINDOW_CONFIGURED", warnings: [] };
  }

  const base = {
    windowId: specific.id,
    registrationType: specific.registrationType as RegistrationTypeValue,
  };

  if (!specific.isOpen) {
    return { ...base, open: false, reason: "WINDOW_CLOSED", warnings: [] };
  }
  if (specific.startsAt && now.getTime() < specific.startsAt.getTime()) {
    return { ...base, open: false, reason: "WINDOW_NOT_STARTED", warnings: [] };
  }
  if (specific.endsAt && now.getTime() > specific.endsAt.getTime()) {
    return { ...base, open: false, reason: "WINDOW_ENDED", warnings: [] };
  }
  return { ...base, open: true, warnings: [] };
}

function specificity(window: RegistrationWindowCandidate): number {
  let score = 0;
  if (window.departmentId) {
    score += 1;
  }
  if (window.cycle) {
    score += 2;
  }
  return score;
}

export function pickMostSpecific(
  candidates: RegistrationWindowCandidate[],
  departmentId: string | null,
  cycle: string | null
): RegistrationWindowCandidate | null {
  const applicable = candidates.filter((w) => {
    if (w.departmentId && w.departmentId !== departmentId) {
      return false;
    }
    if (w.cycle && w.cycle !== cycle) {
      return false;
    }
    return true;
  });

  return (
    [...applicable].sort((a, b) => specificity(b) - specificity(a))[0] ?? null
  );
}
