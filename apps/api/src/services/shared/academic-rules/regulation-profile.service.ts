import { db, Prisma } from "@webcampus/db";
import {
  DEFAULT_POLICY_PROFILE,
  type PolicyProfile,
  type ResolvedPolicyProfile,
} from "./academic-rules.types";

export type PolicyContext = {
  programType?: string | null;
  admissionYear?: string | null;
};

function toProfile(row: {
  maxTotalCredits: number;
  maxSupplementaryCredits: number;
  maxAttemptsBeforeAlternate: number;
  maxAttemptsTotal: number;
}): PolicyProfile {
  return {
    maxTotalCredits: row.maxTotalCredits,
    maxSupplementaryCredits: row.maxSupplementaryCredits,
    maxAttemptsBeforeAlternate: row.maxAttemptsBeforeAlternate,
    maxAttemptsTotal: row.maxAttemptsTotal,
  };
}

export async function resolvePolicyProfile(
  context: PolicyContext,
  tx?: Prisma.TransactionClient
): Promise<ResolvedPolicyProfile> {
  const prisma = tx ?? db;

  if (context.programType != null && context.admissionYear != null) {
    const exact = await prisma.academicPolicyConfig.findUnique({
      where: {
        programType_admissionYear: {
          programType: context.programType as never,
          admissionYear: context.admissionYear,
        },
      },
    });
    if (exact) {
      return { profile: toProfile(exact), source: "EXACT", warnings: [] };
    }
  }

  if (context.programType != null) {
    const programDefault = await prisma.academicPolicyConfig.findFirst({
      where: {
        programType: context.programType as never,
        admissionYear: null,
      },
    });
    if (programDefault) {
      return {
        profile: toProfile(programDefault),
        source: "PROGRAM_DEFAULT_ROW",
        warnings: [],
      };
    }
  }

  const globalDefault = await prisma.academicPolicyConfig.findFirst({
    where: { programType: null, admissionYear: null },
  });
  if (globalDefault) {
    return {
      profile: toProfile(globalDefault),
      source: "GLOBAL_DEFAULT_ROW",
      warnings: [],
    };
  }

  return {
    profile: DEFAULT_POLICY_PROFILE,
    source: "HARDCODED_FALLBACK",
    warnings: ["UNKNOWN_COHORT_DEFAULT_PROFILE"],
  };
}
