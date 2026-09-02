/// <reference types="bun" />
import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
} from "@webcampus/api/src/services/shared/academic-rules/academic-rules.types";
import { describe, expect, it } from "bun:test";
import {
  buildSupplementaryCandidate,
  pickOfferedSupplementaryOfferings,
  SUPPLEMENTARY_IN_PROGRESS_REASON,
  type SuppOfferingRow,
} from "../supplementary.service";

function makeExam(
  outcome: CourseOutcomeValue,
  status: ExamRegistrationStatusValue = "RESULT_DECLARED",
  attemptNumber = 1
) {
  return {
    status,
    outcome,
    attemptNumber,
    registeredAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function makePrior(exams: ReturnType<typeof makeExam>[]) {
  return {
    id: "reg-1",
    courseId: "course-1",
    semesterId: "sem-1",
    status: "ACTIVE" as const,
    registrationDate: new Date("2025-08-01T00:00:00Z"),
    registrationType: "REGULAR" as const,
    course: {
      code: "CS101",
      name: "Intro",
      courseType: "THEORY",
      totalCredits: 4,
    },
    semester: { semesterNumber: 3, programType: "UG" as const },
    academicTerm: { type: "odd", year: "2025" },
    examRegistrations: exams,
  };
}

describe("buildSupplementaryCandidate", () => {
  it("NE with offered course is eligible", () => {
    const candidate = buildSupplementaryCandidate(
      makePrior([makeExam("NE")]),
      false,
      true
    );

    expect(candidate.eligible).toBe(true);
    expect(candidate.reasons).toEqual([]);
    expect(candidate.latestOutcome).toBe("NE");
    expect(candidate.attemptCount).toBe(1);
    expect(candidate.nextAttemptNumber).toBe(2);
  });

  it("P blocks supplementary via OUTCOME_PASSED", () => {
    const candidate = buildSupplementaryCandidate(
      makePrior([makeExam("P")]),
      false,
      true
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("OUTCOME_PASSED");
  });

  it("F routes to reappear only, blocking supplementary", () => {
    const candidate = buildSupplementaryCandidate(
      makePrior([makeExam("F")]),
      false,
      true
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("REAPPEAR_ONLY");
  });

  it("active supplementary registration adds in-progress reason", () => {
    const candidate = buildSupplementaryCandidate(
      makePrior([makeExam("NE")]),
      true,
      true
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain(SUPPLEMENTARY_IN_PROGRESS_REASON);
  });

  it("unoffered course is ineligible with reason", () => {
    const candidate = buildSupplementaryCandidate(
      makePrior([makeExam("NE")]),
      false,
      false
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("COURSE_NOT_OFFERED_FOR_SUPPLEMENTARY");
  });

  it("attempt warnings carry through at threshold", () => {
    const prior = makePrior([
      makeExam("NE", "RESULT_DECLARED", 4),
      makeExam("NE", "RESULT_DECLARED", 3),
    ]);
    const candidate = buildSupplementaryCandidate(prior, false, true);

    expect(candidate.attemptCount).toBe(4);
    expect(candidate.nextAttemptNumber).toBe(5);
    expect(candidate.warnings).toContain("ALTERNATE_PATHWAY_RECOMMENDED");
  });
});

function makeOffering(
  courseId: string,
  termId: string,
  type: string,
  year: string
): SuppOfferingRow {
  return {
    courseId,
    academicTermId: termId,
    academicTerm: { id: termId, type, year },
  };
}

describe("pickOfferedSupplementaryOfferings", () => {
  it("keeps only offerings in supplementary terms", () => {
    const picked = pickOfferedSupplementaryOfferings([
      makeOffering("c1", "odd-2026", "odd", "2026"),
      makeOffering("c2", "supp-2026", "supplementary", "2026"),
    ]);

    expect(picked.size).toBe(1);
    expect(picked.get("c2")?.academicTermId).toBe("supp-2026");
  });

  it("dedupes per course preferring the highest supplementary term year", () => {
    const picked = pickOfferedSupplementaryOfferings([
      makeOffering("c1", "supp-2025", "supplementary", "2025"),
      makeOffering("c1", "supp-2026", "supplementary", "2026"),
      makeOffering("c1", "odd-2026", "odd", "2026"),
    ]);

    expect(picked.get("c1")?.academicTermId).toBe("supp-2026");
  });

  it("returns an empty map when nothing is offered for supplementary", () => {
    const picked = pickOfferedSupplementaryOfferings([
      makeOffering("c1", "even-2025", "even", "2025"),
    ]);

    expect(picked.size).toBe(0);
  });
});
