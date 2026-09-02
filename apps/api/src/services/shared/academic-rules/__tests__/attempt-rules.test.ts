/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import {
  computeAttemptSummary,
  getAttemptCount,
  type AttemptCourseRegistration,
  type AttemptExamRegistration,
} from "../attempt-rules";

const regs = (
  statuses: AttemptCourseRegistration["status"][]
): AttemptCourseRegistration[] =>
  statuses.map((status) => ({
    status,
    registrationType: "REGULAR",
  }));

const exams = (
  rows: Array<
    [
      AttemptExamRegistration["attemptNumber"],
      AttemptExamRegistration["status"],
    ]
  >
): AttemptExamRegistration[] =>
  rows.map(([attemptNumber, status]) => ({
    attemptNumber,
    status,
    outcome: "PENDING",
  }));

describe("computeAttemptSummary", () => {
  it("numbers the first attempt as 1 with no history", () => {
    const summary = computeAttemptSummary([], []);
    expect(summary.attemptCount).toBe(0);
    expect(summary.nextAttemptNumber).toBe(1);
    expect(summary.warnings).toEqual([]);
  });

  it("ignores cancelled registrations", () => {
    const summary = computeAttemptSummary(regs(["CANCELLED"]), []);
    expect(summary.attemptCount).toBe(0);
    expect(summary.nextAttemptNumber).toBe(1);
  });

  it("counts registrations and exam attempt numbers without resetting per term", () => {
    const summary = computeAttemptSummary(
      regs(["ACTIVE", "SUPERSEDED"]),
      exams([
        [2, "RESULT_DECLARED"],
        [3, "REGISTERED"],
      ])
    );
    expect(summary.attemptCount).toBe(3);
    expect(summary.nextAttemptNumber).toBe(4);
  });

  it("takes the max of registration count and exam numbering", () => {
    const summary = computeAttemptSummary(
      regs(["ACTIVE"]),
      exams([[4, "RESULT_DECLARED"]])
    );
    expect(summary.nextAttemptNumber).toBe(5);
  });

  it("emits ALTERNATE_PATHWAY_RECOMMENDED at maxAttemptsBeforeAlternate", () => {
    const summary = computeAttemptSummary(
      regs(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"]),
      [],
      { maxAttemptsBeforeAlternate: 4, maxAttemptsTotal: 5 }
    );
    expect(summary.warnings).toEqual(["ALTERNATE_PATHWAY_RECOMMENDED"]);
  });

  it("emits ATTEMPT_LIMIT_WARNING at maxAttemptsTotal but never blocks", () => {
    const summary = computeAttemptSummary(
      regs(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"]),
      [],
      { maxAttemptsBeforeAlternate: 4, maxAttemptsTotal: 5 }
    );
    expect(summary.warnings).toEqual([
      "ALTERNATE_PATHWAY_RECOMMENDED",
      "ATTEMPT_LIMIT_WARNING",
    ]);
    expect(summary.nextAttemptNumber).toBe(6);
  });
});

describe("getAttemptCount", () => {
  it("matches computeAttemptSummary.attemptCount", () => {
    expect(
      getAttemptCount(regs(["ACTIVE", "CANCELLED"]), exams([[1, "SEATED"]]))
    ).toBe(1);
  });
});
