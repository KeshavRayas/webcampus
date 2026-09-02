/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
} from "../../shared/academic-rules/academic-rules.types";
import {
  buildReRegistrationCandidate,
  RE_REGISTRATION_IN_PROGRESS_REASON,
} from "../re-registration.service";

type ExamRow = {
  id: string;
  status: ExamRegistrationStatusValue;
  outcome: CourseOutcomeValue;
  attemptNumber: number;
  registeredAt: Date;
};

function makeExam(
  status: ExamRegistrationStatusValue,
  outcome: CourseOutcomeValue,
  attemptNumber: number
): ExamRow {
  return {
    id: `exam-${attemptNumber}`,
    status,
    outcome,
    attemptNumber,
    registeredAt: new Date(2026, 0, attemptNumber),
  };
}

function makePrior(exams: ExamRow[]) {
  return {
    id: "prior-1",
    courseId: "course-1",
    semesterId: "semester-1",
    academicTermId: "term-1",
    status: "SUPERSEDED" as const,
    registrationType: "REGULAR" as const,
    course: {
      id: "course-1",
      code: "MA101",
      name: "Mathematics",
      courseType: "PC",
      totalCredits: 4,
    },
    semester: { semesterNumber: 1, programType: "UG" },
    academicTerm: { type: "odd", year: "2024" },
    examRegistrations: exams,
  };
}

describe("buildReRegistrationCandidate", () => {
  it("marks NE outcome as eligible with no denial reasons", () => {
    const candidate = buildReRegistrationCandidate(
      makePrior([makeExam("RESULT_DECLARED", "NE", 1)]),
      false
    );

    expect(candidate.eligible).toBe(true);
    expect(candidate.reasons).toEqual([]);
    expect(candidate.latestOutcome).toBe("NE");
    expect(candidate.nextAttemptNumber).toBe(2);
    expect(candidate.attemptCount).toBe(1);
  });

  it("blocks passed outcomes with OUTCOME_PASSED", () => {
    const candidate = buildReRegistrationCandidate(
      makePrior([makeExam("RESULT_DECLARED", "P", 1)]),
      false
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("OUTCOME_PASSED");
  });

  it("blocks F outcomes as reappear-only", () => {
    const candidate = buildReRegistrationCandidate(
      makePrior([makeExam("RESULT_DECLARED", "F", 1)]),
      false
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("REAPPEAR_ONLY");
  });

  it("blocks in-flight attempts with ATTEMPT_IN_PROGRESS", () => {
    const candidate = buildReRegistrationCandidate(
      makePrior([makeExam("REGISTERED", "PENDING", 1)]),
      false
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("ATTEMPT_IN_PROGRESS");
  });

  it("flags an already-active redo via its dedicated reason", () => {
    const candidate = buildReRegistrationCandidate(
      makePrior([makeExam("RESULT_DECLARED", "NE", 1)]),
      true
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain(RE_REGISTRATION_IN_PROGRESS_REASON);
  });

  it("surfaces advisory attempt warnings from the rules layer", () => {
    const candidate = buildReRegistrationCandidate(
      makePrior([
        makeExam("RESULT_DECLARED", "NE", 1),
        makeExam("RESULT_DECLARED", "NE", 2),
        makeExam("RESULT_DECLARED", "NE", 3),
        makeExam("RESULT_DECLARED", "NE", 4),
      ]),
      false
    );

    expect(candidate.eligible).toBe(true);
    expect(candidate.warnings).toContain("ALTERNATE_PATHWAY_RECOMMENDED");
    expect(candidate.nextAttemptNumber).toBe(5);
  });
});
