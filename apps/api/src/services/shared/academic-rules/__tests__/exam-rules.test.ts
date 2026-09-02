/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import { canTakeSEE, deriveLatestOutcome } from "../exam-rules";

describe("canTakeSEE", () => {
  it("allows an active, CIE-eligible attempt with no concluded exam", () => {
    const verdict = canTakeSEE({
      hasActiveRegistration: true,
      cieEligible: true,
    });
    expect(verdict.allowed).toBe(true);
  });

  it("denies without an active registration", () => {
    const verdict = canTakeSEE({
      hasActiveRegistration: false,
      cieEligible: true,
    });
    expect(verdict.reasons).toEqual(["NO_ACTIVE_REGISTRATION"]);
  });

  it("blocks SEE after NE until a fresh registration exists", () => {
    const blocked = canTakeSEE({
      hasActiveRegistration: true,
      cieEligible: true,
      latestExamStatus: "RESULT_DECLARED",
      latestExamOutcome: "NE",
      hasFreshRegistrationAfterNE: false,
    });
    expect(blocked.reasons).toEqual(["SEE_BLOCKED_NOT_ELIGIBLE"]);

    const unblocked = canTakeSEE({
      hasActiveRegistration: true,
      cieEligible: true,
      latestExamStatus: "RESULT_DECLARED",
      latestExamOutcome: "NE",
      hasFreshRegistrationAfterNE: true,
    });
    expect(unblocked.allowed).toBe(true);
  });

  it("denies when the latest attempt already concluded", () => {
    for (const status of ["RESULT_DECLARED", "CANCELLED"] as const) {
      const verdict = canTakeSEE({
        hasActiveRegistration: true,
        cieEligible: true,
        latestExamStatus: status,
        latestExamOutcome: "F",
      });
      expect(verdict.reasons).toEqual(["ATTEMPT_ALREADY_CONCLUDED"]);
    }
  });

  it("denies on CIE ineligibility", () => {
    const verdict = canTakeSEE({
      hasActiveRegistration: true,
      cieEligible: false,
    });
    expect(verdict.reasons).toEqual(["CIE_NOT_ELIGIBLE"]);
  });
});

describe("deriveLatestOutcome", () => {
  it("returns nulls with no attempts", () => {
    expect(deriveLatestOutcome([])).toEqual({ status: null, outcome: null });
  });

  it("ignores cancelled rows", () => {
    const latest = deriveLatestOutcome([
      {
        status: "CANCELLED",
        outcome: "F",
        registeredAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);
    expect(latest.status).toBeNull();
    expect(latest.outcome).toBeNull();
  });

  it("prefers the newest declared result", () => {
    const latest = deriveLatestOutcome([
      {
        status: "RESULT_DECLARED",
        outcome: "F",
        registeredAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        status: "RESULT_DECLARED",
        outcome: "P",
        registeredAt: new Date("2026-06-01T00:00:00Z"),
      },
    ]);
    expect(latest.outcome).toBe("P");
  });

  it("reports PENDING while the newest attempt is in flight", () => {
    const latest = deriveLatestOutcome([
      {
        status: "RESULT_DECLARED",
        outcome: "F",
        registeredAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        status: "REGISTERED",
        outcome: "PENDING",
        registeredAt: new Date("2026-07-01T00:00:00Z"),
      },
    ]);
    expect(latest.status).toBe("REGISTERED");
    expect(latest.outcome).toBe("PENDING");
  });
});
