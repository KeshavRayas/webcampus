/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import { academicEligibility } from "../academic-eligibility.service";

describe("hall-ticket academic eligibility isolation", () => {
  it("keeps a frozen student available even when CIE status is not eligible", () => {
    const result = academicEligibility.computeCourseEligibility(
      { cieTotal: 10, status: "NOT_ELIGIBLE" },
      { percentage: 90, condonationStatus: "NONE" },
      { facultyFrozen: true, hodFrozen: true, adminFrozen: true }
    );

    expect(result.isFrozen).toBe(true);
    expect(result.markEligible).toBe(false);
    expect(result.eligible).toBe(false);
  });

  it("keeps an unfrozen student unavailable regardless of marks", () => {
    const result = academicEligibility.computeCourseEligibility(
      { cieTotal: 50, status: "ELIGIBLE" },
      { percentage: 90, condonationStatus: "NONE" },
      null
    );

    expect(result.isFrozen).toBe(false);
    expect(result.markEligible).toBe(true);
    expect(result.eligible).toBe(false);
  });
});
