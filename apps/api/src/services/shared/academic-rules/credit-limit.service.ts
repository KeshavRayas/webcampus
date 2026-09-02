import { Prisma } from "@webcampus/db";
import type {
  PolicyProfile,
  ResolvedPolicyProfile,
  RuleDenialReason,
  RuleVerdict,
} from "./academic-rules.types";
import { deny } from "./academic-rules.types";
import {
  resolvePolicyProfile,
  type PolicyContext,
} from "./regulation-profile.service";

export type CreditRequest = {
  totalCredits: number;
  supplementaryCredits: number;
};

export type CreditViolation = {
  scope: "TOTAL" | "SUPPLEMENTARY";
  requested: number;
  max: number;
};

export type CreditValidation = {
  withinLimits: boolean;
  violations: CreditViolation[];
};

export function validateCreditLimits(
  profile: PolicyProfile,
  request: CreditRequest
): CreditValidation {
  const violations: CreditViolation[] = [];

  if (request.totalCredits > profile.maxTotalCredits) {
    violations.push({
      scope: "TOTAL",
      requested: request.totalCredits,
      max: profile.maxTotalCredits,
    });
  }
  if (request.supplementaryCredits > profile.maxSupplementaryCredits) {
    violations.push({
      scope: "SUPPLEMENTARY",
      requested: request.supplementaryCredits,
      max: profile.maxSupplementaryCredits,
    });
  }

  return { withinLimits: violations.length === 0, violations };
}

export async function checkCreditLimit(
  context: PolicyContext,
  request: CreditRequest,
  tx?: Prisma.TransactionClient
): Promise<{ verdict: RuleVerdict; resolved: ResolvedPolicyProfile }> {
  const resolved = await resolvePolicyProfile(context, tx);
  const validation = validateCreditLimits(resolved.profile, request);

  if (!validation.withinLimits) {
    const reasons: RuleDenialReason[] = [];
    for (const violation of validation.violations) {
      if (violation.scope === "TOTAL") {
        reasons.push("CREDIT_LIMIT_EXCEEDED_TOTAL");
      } else {
        reasons.push("CREDIT_LIMIT_EXCEEDED_SUPPLEMENTARY");
      }
    }
    return { verdict: deny(reasons, resolved.warnings), resolved };
  }

  return {
    verdict: { allowed: true, reasons: [], warnings: resolved.warnings },
    resolved,
  };
}
