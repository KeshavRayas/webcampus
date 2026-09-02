export type RegistrationTypeValue =
  | "REGULAR"
  | "RE_REGISTRATION"
  | "SUPPLEMENTARY";

export type RegistrationStatusValue = "ACTIVE" | "CANCELLED" | "SUPERSEDED";

export type ExamRegistrationStatusValue =
  | "REGISTERED"
  | "SEATED"
  | "RESULT_DECLARED"
  | "CANCELLED";

export type CourseOutcomeValue = "PENDING" | "P" | "F" | "NE" | "W" | "I" | "X";

export type RuleWarning =
  | "ATTEMPT_LIMIT_WARNING"
  | "ALTERNATE_PATHWAY_RECOMMENDED"
  | "UNKNOWN_COHORT_DEFAULT_PROFILE";

export type RuleDenialReason =
  | "OUTCOME_PASSED"
  | "ATTEMPT_IN_PROGRESS"
  | "RESULT_INCOMPLETE"
  | "REAPPEAR_ONLY"
  | "NEEDS_FRESH_REGISTRATION"
  | "NO_ACTIVE_REGISTRATION"
  | "SEE_BLOCKED_NOT_ELIGIBLE"
  | "ATTEMPT_ALREADY_CONCLUDED"
  | "CIE_NOT_ELIGIBLE"
  | "NO_WINDOW_CONFIGURED"
  | "WINDOW_CLOSED"
  | "WINDOW_NOT_STARTED"
  | "WINDOW_ENDED"
  | "CREDIT_LIMIT_EXCEEDED_TOTAL"
  | "CREDIT_LIMIT_EXCEEDED_SUPPLEMENTARY";

export type PolicyProfile = {
  maxTotalCredits: number;
  maxSupplementaryCredits: number;
  maxAttemptsBeforeAlternate: number;
  maxAttemptsTotal: number;
};

export const DEFAULT_POLICY_PROFILE: PolicyProfile = {
  maxTotalCredits: 30,
  maxSupplementaryCredits: 16,
  maxAttemptsBeforeAlternate: 4,
  maxAttemptsTotal: 5,
};

export type PolicyProfileSource =
  | "EXACT"
  | "PROGRAM_DEFAULT_ROW"
  | "GLOBAL_DEFAULT_ROW"
  | "HARDCODED_FALLBACK";

export type ResolvedPolicyProfile = {
  profile: PolicyProfile;
  source: PolicyProfileSource;
  warnings: RuleWarning[];
};

export type RuleVerdict = {
  allowed: boolean;
  reasons: RuleDenialReason[];
  warnings: RuleWarning[];
};

export function allow(warnings: RuleWarning[] = []): RuleVerdict {
  return { allowed: true, reasons: [], warnings };
}

export function deny(
  reasons: RuleDenialReason[],
  warnings: RuleWarning[] = []
): RuleVerdict {
  return { allowed: false, reasons, warnings };
}
