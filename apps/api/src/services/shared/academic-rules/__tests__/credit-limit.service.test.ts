/// <reference types="bun" />

import type { AcademicPolicyConfig } from "@webcampus/db";
import { describe, expect, it } from "bun:test";
import { validateCreditLimits } from "../credit-limit.service";
import { resolvePolicyProfile } from "../regulation-profile.service";

function policyRow(
  overrides: Partial<AcademicPolicyConfig> = {}
): AcademicPolicyConfig {
  return {
    id: "p1",
    programType: null,
    admissionYear: null,
    maxTotalCredits: 30,
    maxSupplementaryCredits: 16,
    maxAttemptsBeforeAlternate: 4,
    maxAttemptsTotal: 5,
    ...overrides,
  };
}

describe("validateCreditLimits", () => {
  const profile = {
    maxTotalCredits: 30,
    maxSupplementaryCredits: 16,
    maxAttemptsBeforeAlternate: 4,
    maxAttemptsTotal: 5,
  };

  it("passes within limits", () => {
    const result = validateCreditLimits(profile, {
      totalCredits: 30,
      supplementaryCredits: 16,
    });
    expect(result.withinLimits).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("flags total overflow with CREDIT_LIMIT_EXCEEDED_TOTAL semantics", () => {
    const result = validateCreditLimits(profile, {
      totalCredits: 31,
      supplementaryCredits: 0,
    });
    expect(result.withinLimits).toBe(false);
    expect(result.violations).toEqual([
      { scope: "TOTAL", requested: 31, max: 30 },
    ]);
  });

  it("flags supplementary overflow separately (>16 credits rejected)", () => {
    const result = validateCreditLimits(profile, {
      totalCredits: 10,
      supplementaryCredits: 17,
    });
    expect(result.withinLimits).toBe(false);
    expect(result.violations).toEqual([
      { scope: "SUPPLEMENTARY", requested: 17, max: 16 },
    ]);
  });
});

type FakePolicyClient = {
  academicPolicyConfig: {
    findUnique: (args: {
      where: {
        programType_admissionYear: {
          programType: string;
          admissionYear: string;
        };
      };
    }) => Promise<AcademicPolicyConfig | null>;
    findFirst: (args: {
      where: { programType: string | null; admissionYear: string | null };
    }) => Promise<AcademicPolicyConfig | null>;
  };
};

function fakeClient(
  rows: Array<Partial<AcademicPolicyConfig> & { key?: string }>
): FakePolicyClient {
  const find = (
    match: (row: Record<string, unknown>) => boolean
  ): AcademicPolicyConfig | null => {
    const hit = rows.find((row) =>
      match({
        programType: row.programType ?? null,
        admissionYear: row.admissionYear ?? null,
        key: row.key,
      })
    );
    return hit ? policyRow(hit) : null;
  };

  return {
    academicPolicyConfig: {
      findUnique: async ({ where }) =>
        find(
          (r) =>
            r.key === "exact" &&
            r.programType === where.programType_admissionYear.programType &&
            r.admissionYear === where.programType_admissionYear.admissionYear
        ),
      findFirst: async ({ where }) =>
        find(
          (r) =>
            r.programType === where.programType &&
            r.admissionYear === where.admissionYear
        ),
    },
  };
}

describe("resolvePolicyProfile", () => {
  it("uses the exact cohort row when present", async () => {
    const tx = fakeClient([
      {
        key: "exact",
        programType: "UG",
        admissionYear: "2024",
        maxSupplementaryCredits: 12,
      },
    ]);
    const resolved = await resolvePolicyProfile(
      { programType: "UG", admissionYear: "2024" },
      tx as never
    );
    expect(resolved.source).toBe("EXACT");
    expect(resolved.profile.maxSupplementaryCredits).toBe(12);
    expect(resolved.warnings).toEqual([]);
  });

  it("falls back to the program default row, then global row", async () => {
    const tx = fakeClient([
      { programType: "UG", admissionYear: null, maxTotalCredits: 28 },
      { programType: null, admissionYear: null, maxTotalCredits: 26 },
    ]);

    const programLevel = await resolvePolicyProfile(
      { programType: "UG", admissionYear: "2025" },
      tx as never
    );
    expect(programLevel.source).toBe("PROGRAM_DEFAULT_ROW");
    expect(programLevel.profile.maxTotalCredits).toBe(28);

    const globalLevel = await resolvePolicyProfile(
      { programType: "PG", admissionYear: "2025" },
      tx as never
    );
    expect(globalLevel.source).toBe("GLOBAL_DEFAULT_ROW");
    expect(globalLevel.profile.maxTotalCredits).toBe(26);
  });

  it("warns and uses hardcoded defaults for an unknown cohort with no rows", async () => {
    const resolved = await resolvePolicyProfile(
      { programType: "PG", admissionYear: "1999" },
      fakeClient([]) as never
    );
    expect(resolved.source).toBe("HARDCODED_FALLBACK");
    expect(resolved.warnings).toEqual(["UNKNOWN_COHORT_DEFAULT_PROFILE"]);
    expect(resolved.profile).toEqual({
      maxTotalCredits: 30,
      maxSupplementaryCredits: 16,
      maxAttemptsBeforeAlternate: 4,
      maxAttemptsTotal: 5,
    });
  });
});
