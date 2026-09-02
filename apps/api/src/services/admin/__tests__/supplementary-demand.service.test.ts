/// <reference types="bun" />
import {
  buildSupplementaryDemandRows,
  supplementaryWindowSettledMessage,
  type SupplementaryDemandOfferingInput,
  type SupplementaryDemandQueryData,
} from "@webcampus/api/src/services/admin/supplementary.service";
import { describe, expect, it } from "bun:test";

function offering(
  overrides: Partial<SupplementaryDemandOfferingInput> = {}
): SupplementaryDemandOfferingInput {
  return {
    id: "off-1",
    courseId: "course-1",
    course: {
      code: "21CS72",
      name: "Machine Learning",
      courseType: "PC",
      totalCredits: 4,
      semester: { id: "sem-orig-1", semesterNumber: 7, programType: "UG" },
    },
    ...overrides,
  };
}

function emptyQuery(): SupplementaryDemandQueryData {
  return {
    registrationsByCourse: new Map(),
    facultyByCourse: new Map(),
    sectionsByCourse: new Map(),
    openWindowsByCourse: new Map(),
  };
}

describe("buildSupplementaryDemandRows", () => {
  it("maps registration counts, faculty, sections and window state per offering", () => {
    const query = emptyQuery();
    query.registrationsByCourse.set("course-1", 23);
    query.facultyByCourse.set("course-1", ["Dr. A", "Dr. B"]);
    query.sectionsByCourse.set("off-1", [
      { id: "sec-1", name: "SUP-A", studentCount: 12, facultyNames: ["Dr. A"] },
    ]);
    query.openWindowsByCourse.set("course-1", true);

    const rows = buildSupplementaryDemandRows([offering()], query);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      offeringId: "off-1",
      courseId: "course-1",
      code: "21CS72",
      name: "Machine Learning",
      totalCredits: 4,
      semesterNumber: 7,
      programType: "UG",
      activeRegistrationCount: 23,
      lastTaughtBy: ["Dr. A", "Dr. B"],
      windowOpen: true,
    });
    const row = rows[0];
    if (!row) {
      throw new Error("Expected one demand row");
    }
    expect(row.sections).toEqual([
      { id: "sec-1", name: "SUP-A", studentCount: 12, facultyNames: ["Dr. A"] },
    ]);
  });

  it("keeps zero-demand offerings with empty defaults", () => {
    const rows = buildSupplementaryDemandRows([offering()], emptyQuery());

    const row = rows[0];
    if (!row) {
      throw new Error("Expected one demand row");
    }
    expect(row.activeRegistrationCount).toBe(0);
    expect(row.lastTaughtBy).toEqual([]);
    expect(row.sections).toEqual([]);
    expect(row.windowOpen).toBe(false);
  });

  it("falls back to UG / 0 when the course has no semester", () => {
    const rows = buildSupplementaryDemandRows(
      [
        offering({
          course: {
            code: "21CS72",
            name: "Machine Learning",
            courseType: "PC",
            totalCredits: 4,
            semester: null,
          },
        }),
      ],
      emptyQuery()
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Expected one demand row");
    }
    expect(row.semesterNumber).toBe(0);
    expect(row.programType).toBe("UG");
  });
});

describe("supplementaryWindowSettledMessage", () => {
  it("blocks while the window is open", () => {
    expect(supplementaryWindowSettledMessage({ open: true })).toBe(
      "Supplementary registration window is still open — close it before creating sections or placing students"
    );
  });

  it("allows section creation once the window is closed or not configured", () => {
    expect(supplementaryWindowSettledMessage({ open: false })).toBeNull();
    expect(
      supplementaryWindowSettledMessage({ open: false, reason: "WINDOW_ENDED" })
    ).toBeNull();
    expect(
      supplementaryWindowSettledMessage({
        open: false,
        reason: "NO_WINDOW_CONFIGURED",
      })
    ).toBeNull();
  });
});
