/// <reference types="bun" />
import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
} from "@webcampus/api/src/services/shared/academic-rules/academic-rules.types";
import { describe, expect, it } from "bun:test";
import {
  buildReappearCandidate,
  REAPPEAR_ALREADY_REGISTERED_REASON,
} from "../exam-registration.service";

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
    status: "ACTIVE" as const,
    registrationType: "REGULAR" as const,
    course: { code: "CS101", name: "Intro", courseType: "THEORY" },
    semester: { semesterNumber: 3 },
    academicTerm: { type: "odd", year: "2025" },
    examRegistrations: exams,
  };
}

describe("buildReappearCandidate", () => {
  it("F is eligible for reappear with no blocking reasons", () => {
    const candidate = buildReappearCandidate(makePrior([makeExam("F")]), false);

    expect(candidate.eligible).toBe(true);
    expect(candidate.reasons).toEqual([]);
    expect(candidate.latestOutcome).toBe("F");
    expect(candidate.attemptCount).toBe(1);
    expect(candidate.nextAttemptNumber).toBe(2);
  });

  it("P blocks reappear via OUTCOME_PASSED", () => {
    const candidate = buildReappearCandidate(makePrior([makeExam("P")]), false);

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("OUTCOME_PASSED");
  });

  it("NE requires a fresh registration instead of a reappear", () => {
    const candidate = buildReappearCandidate(
      makePrior([makeExam("NE")]),
      false
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("NEEDS_FRESH_REGISTRATION");
  });

  it("PENDING attempt blocks via ATTEMPT_IN_PROGRESS", () => {
    const candidate = buildReappearCandidate(
      makePrior([makeExam("PENDING", "REGISTERED", 2)]),
      false
    );

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain("ATTEMPT_IN_PROGRESS");
  });

  it("active reappear registration adds in-progress reason", () => {
    const candidate = buildReappearCandidate(makePrior([makeExam("F")]), true);

    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toContain(REAPPEAR_ALREADY_REGISTERED_REASON);
  });

  it("attempt warnings carry through at threshold", () => {
    const prior = makePrior([
      makeExam("F", "RESULT_DECLARED", 4),
      makeExam("F", "RESULT_DECLARED", 3),
    ]);
    const candidate = buildReappearCandidate(prior, false);

    expect(candidate.attemptCount).toBe(4);
    expect(candidate.nextAttemptNumber).toBe(5);
    expect(candidate.warnings).toContain("ALTERNATE_PATHWAY_RECOMMENDED");
  });
});
