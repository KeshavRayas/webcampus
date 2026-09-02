import { getTermLabel } from "@webcampus/common/term-label";
import {
  CreateAcademicTermSchema,
  CreateSemesterConfigListSchema,
  UpdateAcademicTermSchema,
} from "@webcampus/schemas/admin";
import { describe, expect, it } from "bun:test";

const baseTerm = {
  year: "2026",
};

describe("CreateAcademicTermSchema parity rules", () => {
  it("requires parity for supplementary terms", () => {
    const result = CreateAcademicTermSchema.safeParse({
      ...baseTerm,
      type: "supplementary",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("parity"))).toBe(
        true
      );
    }
  });

  it("accepts odd and even supplementary terms", () => {
    for (const parity of ["odd", "even"] as const) {
      const result = CreateAcademicTermSchema.safeParse({
        ...baseTerm,
        type: "supplementary",
        parity,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects parity on regular odd/even terms", () => {
    for (const type of ["odd", "even"] as const) {
      const result = CreateAcademicTermSchema.safeParse({
        ...baseTerm,
        type,
        parity: "odd",
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts regular terms without parity", () => {
    for (const type of ["odd", "even"] as const) {
      const result = CreateAcademicTermSchema.safeParse({
        ...baseTerm,
        type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("UpdateAcademicTermSchema lenient parity", () => {
  it("allows supplementary updates without parity (legacy rows)", () => {
    const result = UpdateAcademicTermSchema.safeParse({
      ...baseTerm,
      type: "supplementary",
      isCurrent: true,
    });
    expect(result.success).toBe(true);
  });

  it("still rejects parity on non-supplementary terms", () => {
    const result = UpdateAcademicTermSchema.safeParse({
      ...baseTerm,
      type: "even",
      parity: "odd",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateSemesterConfigListSchema single-parity rule", () => {
  const item = (semesterNumber: number) => ({
    academicTermId: "00000000-0000-0000-0000-000000000000",
    programType: "UG" as const,
    semesterNumber,
    termType: "supplementary" as const,
    startDate: "2026-06-01",
    endDate: "2026-07-01",
    userId: "00000000-0000-0000-0000-000000000000",
  });

  it("accepts all-odd or all-even supplementary semesters", () => {
    for (const numbers of [
      [1, 3],
      [2, 4],
    ] as const) {
      const result = CreateSemesterConfigListSchema.safeParse(
        numbers.map(item)
      );
      expect(result.success).toBe(true);
    }
  });

  it("rejects mixed-parity supplementary semesters", () => {
    const result = CreateSemesterConfigListSchema.safeParse([1, 4].map(item));
    expect(result.success).toBe(false);
  });

  it("does not restrict regular terms", () => {
    const result = CreateSemesterConfigListSchema.safeParse(
      [1, 2].map((n) => ({
        ...item(n),
        termType: n % 2 === 1 ? ("odd" as const) : ("even" as const),
      }))
    );
    expect(result.success).toBe(true);
  });
});

describe("getTermLabel", () => {
  it("prefixes parity for supplementary terms", () => {
    expect(getTermLabel("supplementary", "2026", "odd")).toBe(
      "Odd Supplementary 2026"
    );
    expect(getTermLabel("supplementary", "2026", "even")).toBe(
      "Even Supplementary 2026"
    );
  });

  it("falls back to plain label without parity", () => {
    expect(getTermLabel("supplementary", "2026", null)).toBe(
      "Supplementary 2026"
    );
    expect(getTermLabel("odd", "2026")).toBe("Odd 2026");
  });
});
