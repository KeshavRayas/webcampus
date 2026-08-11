/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import {
  academicEligibility,
  buildSectionBySemester,
  pickSectionForRegistration,
} from "../academic-eligibility.service";

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

describe("hall-ticket section resolution", () => {
  it("maps each semester to its section", () => {
    const map = buildSectionBySemester([
      { sectionId: "sec-a", section: { semesterId: "sem-1" } },
      { sectionId: "sec-b", section: { semesterId: "sem-3" } },
      { sectionId: "sec-c", section: null },
    ]);

    expect(map.get("sem-1")).toBe("sec-a");
    expect(map.get("sem-3")).toBe("sec-b");
    expect(map.size).toBe(2);
  });

  it("prefers the section of the registration's semester over the latest section", () => {
    const bySemester = new Map<string, string>([
      ["sem-1", "sec-a"],
      ["sem-3", "sec-b"],
    ]);

    expect(pickSectionForRegistration("sem-1", bySemester, "sec-b")).toBe(
      "sec-a"
    );
  });

  it("falls back to the latest section when the semester has no section record", () => {
    const bySemester = new Map<string, string>([["sem-3", "sec-b"]]);

    expect(pickSectionForRegistration("sem-1", bySemester, "sec-b")).toBe(
      "sec-b"
    );
  });

  it("returns null when neither the semester nor a fallback section exists", () => {
    expect(
      pickSectionForRegistration("sem-1", new Map<string, string>(), null)
    ).toBeNull();
  });
});
