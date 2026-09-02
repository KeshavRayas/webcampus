/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import type { CourseOutcomeValue } from "../academic-rules.types";
import {
  canReappearForExam,
  canRegisterSupplementaryCourse,
  canReRegister,
  evaluateRegistrationWindow,
  resolveRegistrationPathway,
  type RegistrationWindowCandidate,
} from "../registration-rules";

const NOW = new Date("2026-08-21T10:00:00Z");

function window(
  overrides: Partial<RegistrationWindowCandidate> = {}
): RegistrationWindowCandidate {
  return {
    id: "w1",
    departmentId: null,
    cycle: null,
    registrationType: "REGULAR",
    isOpen: true,
    startsAt: new Date("2026-08-01T00:00:00Z"),
    endsAt: new Date("2026-08-31T00:00:00Z"),
    ...overrides,
  };
}

describe("resolveRegistrationPathway", () => {
  it("allows nothing for passed, pending, and incomplete outcomes", () => {
    for (const outcome of ["P", "PENDING", "I"] as CourseOutcomeValue[]) {
      const pathway = resolveRegistrationPathway(outcome, true);
      expect(pathway).toEqual({
        reRegisterAllowed: false,
        supplementaryRegistrationAllowed: false,
        reappearExamAllowed: false,
      });
    }
  });

  it("sends F to reappear exam only (no new CourseRegistration)", () => {
    const pathway = resolveRegistrationPathway("F", true);
    expect(pathway.reappearExamAllowed).toBe(true);
    expect(pathway.reRegisterAllowed).toBe(false);
    expect(pathway.supplementaryRegistrationAllowed).toBe(false);
  });

  it("treats eligible X like F (absent for SEE)", () => {
    const pathway = resolveRegistrationPathway("X", true);
    expect(pathway.reappearExamAllowed).toBe(true);
    expect(pathway.reRegisterAllowed).toBe(false);
  });

  it("treats ineligible X like NE (fresh registration required)", () => {
    const pathway = resolveRegistrationPathway("X", false);
    expect(pathway.reRegisterAllowed).toBe(true);
    expect(pathway.supplementaryRegistrationAllowed).toBe(true);
    expect(pathway.reappearExamAllowed).toBe(false);
  });

  it("routes NE and W to fresh registrations only", () => {
    for (const outcome of ["NE", "W"] as CourseOutcomeValue[]) {
      const pathway = resolveRegistrationPathway(outcome, false);
      expect(pathway.reRegisterAllowed).toBe(true);
      expect(pathway.supplementaryRegistrationAllowed).toBe(true);
      expect(pathway.reappearExamAllowed).toBe(false);
    }
  });
});

describe("canReRegister / canRegisterSupplementaryCourse / canReappearForExam verdicts", () => {
  it("denies re-registration for F with REAPPEAR_ONLY", () => {
    const verdict = canReRegister("F");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons).toEqual(["REAPPEAR_ONLY"]);
  });

  it("denies NE with NEEDS_FRESH_REGISTRATION on the exam path but allows the registration path", () => {
    expect(canReappearForExam("NE", true).reasons).toEqual([
      "NEEDS_FRESH_REGISTRATION",
    ]);
    expect(canReRegister("NE").allowed).toBe(true);
    expect(canRegisterSupplementaryCourse("NE").allowed).toBe(true);
  });

  it("reports ATTEMPT_IN_PROGRESS while outcome is pending", () => {
    expect(canReRegister("PENDING").reasons).toEqual(["ATTEMPT_IN_PROGRESS"]);
    expect(canReappearForExam("PENDING", true).allowed).toBe(false);
  });

  it("reports OUTCOME_PASSED for P", () => {
    expect(canReRegister("P").reasons).toEqual(["OUTCOME_PASSED"]);
  });
});

describe("evaluateRegistrationWindow", () => {
  it("returns NO_WINDOW_CONFIGURED when no candidate matches", () => {
    const result = evaluateRegistrationWindow(
      "SUPPLEMENTARY",
      {
        academicTermId: "t1",
        semesterId: "s1",
        departmentId: null,
        cycle: null,
      },
      [window()],
      NOW
    );
    expect(result.open).toBe(false);
    expect(result.reason).toBe("NO_WINDOW_CONFIGURED");
  });

  it("rejects a closed toggle even inside dates", () => {
    const result = evaluateRegistrationWindow(
      "REGULAR",
      {
        academicTermId: "t1",
        semesterId: "s1",
        departmentId: null,
        cycle: null,
      },
      [window({ isOpen: false })],
      NOW
    );
    expect(result.open).toBe(false);
    expect(result.reason).toBe("WINDOW_CLOSED");
  });

  it("rejects before startsAt and after endsAt", () => {
    const early = evaluateRegistrationWindow(
      "REGULAR",
      {
        academicTermId: "t1",
        semesterId: "s1",
        departmentId: null,
        cycle: null,
      },
      [window()],
      new Date("2026-07-15T00:00:00Z")
    );
    expect(early.reason).toBe("WINDOW_NOT_STARTED");

    const late = evaluateRegistrationWindow(
      "REGULAR",
      {
        academicTermId: "t1",
        semesterId: "s1",
        departmentId: null,
        cycle: null,
      },
      [window()],
      new Date("2026-09-15T00:00:00Z")
    );
    expect(late.reason).toBe("WINDOW_ENDED");
  });

  it("opens when isOpen and now within nullable date bounds", () => {
    const result = evaluateRegistrationWindow(
      "RE_REGISTRATION",
      {
        academicTermId: "t1",
        semesterId: "s1",
        departmentId: null,
        cycle: null,
      },
      [
        window({
          id: "w2",
          registrationType: "RE_REGISTRATION",
          startsAt: null,
          endsAt: null,
        }),
      ],
      NOW
    );
    expect(result.open).toBe(true);
    expect(result.windowId).toBe("w2");
  });

  it("prefers the most specific window (cycle > department > global)", () => {
    const candidates = [
      window({ id: "global" }),
      window({ id: "dept", departmentId: "d1" }),
      window({ id: "cycle", departmentId: "d1", cycle: "PHYSICS" }),
    ];
    const picked = evaluateRegistrationWindow(
      "REGULAR",
      {
        academicTermId: "t1",
        semesterId: "s1",
        departmentId: "d1",
        cycle: "PHYSICS",
      },
      candidates,
      NOW
    );
    expect(picked.windowId).toBe("cycle");
  });

  it("falls back to a global window when scoped ones do not apply", () => {
    const candidates = [
      window({ id: "dept", departmentId: "d9" }),
      window({ id: "global" }),
    ];
    const picked = evaluateRegistrationWindow(
      "REGULAR",
      {
        academicTermId: "t1",
        semesterId: "s1",
        departmentId: "d1",
        cycle: null,
      },
      candidates,
      NOW
    );
    expect(picked.open).toBe(true);
    expect(picked.windowId).toBe("global");
  });
});
