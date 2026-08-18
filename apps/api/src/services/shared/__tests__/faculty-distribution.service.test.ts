/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

let hasAttendanceOrMarksResult = false;

const dbMock = {
  attendance: {
    findFirst: async () =>
      hasAttendanceOrMarksResult ? { id: "att-1" } : null,
  },
  mark: {
    findFirst: async () =>
      hasAttendanceOrMarksResult ? { id: "mark-1" } : null,
  },
  classSession: {
    findFirst: async () =>
      hasAttendanceOrMarksResult ? { id: "sess-1" } : null,
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {},
  CourseApprovalStatus: {
    DRAFT: "DRAFT",
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
}));

describe("computeBalancedFacultyProposal", () => {
  let computeBalancedFacultyProposal: typeof import("../faculty-distribution").computeBalancedFacultyProposal;

  beforeEach(async () => {
    const mod = await import("../faculty-distribution");
    computeBalancedFacultyProposal = mod.computeBalancedFacultyProposal;
    hasAttendanceOrMarksResult = false;
  });

  const groups = (n: number, hasFaculty = false) =>
    Array.from({ length: n }, (_, i) => ({
      id: `g-${i + 1}`,
      sortOrder: i,
      hasFaculty,
    }));

  const faculty = (...names: string[]) =>
    names.map((name, i) => ({ id: `f-${i + 1}`, name }));

  it("throws when no faculty is available", () => {
    expect(() => computeBalancedFacultyProposal(groups(3), [])).toThrow(
      "No faculty available to propose for project groups"
    );
  });

  it("assigns distinct faculty when there are at least as many faculty as groups", () => {
    const proposal = computeBalancedFacultyProposal(
      groups(3),
      faculty("Ambuja", "Ravi", "Kavya")
    );
    expect(proposal).toEqual([
      { groupId: "g-1", facultyId: "f-1" },
      { groupId: "g-2", facultyId: "f-2" },
      { groupId: "g-3", facultyId: "f-3" },
    ]);
  });

  it("does not reuse a faculty when faculty count equals group count", () => {
    const proposal = computeBalancedFacultyProposal(
      groups(2),
      faculty("Ambuja", "Ravi")
    );
    const facultyIds = proposal.map((p) => p.facultyId);
    expect(new Set(facultyIds).size).toBe(2);
  });

  it("distributes groups deterministically across fewer faculty", () => {
    const proposal = computeBalancedFacultyProposal(
      groups(5),
      faculty("Ambuja", "Ravi")
    );
    expect(proposal).toEqual([
      { groupId: "g-1", facultyId: "f-1" },
      { groupId: "g-2", facultyId: "f-1" },
      { groupId: "g-3", facultyId: "f-1" },
      { groupId: "g-4", facultyId: "f-2" },
      { groupId: "g-5", facultyId: "f-2" },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const first = computeBalancedFacultyProposal(
      groups(7),
      faculty("Ambuja", "Ravi", "Kavya")
    );
    const second = computeBalancedFacultyProposal(
      groups(7),
      faculty("Ambuja", "Ravi", "Kavya")
    );
    expect(first).toEqual(second);
  });

  it("preserves existing manual mappings by default", () => {
    const proposal = computeBalancedFacultyProposal(
      [
        { id: "g-1", sortOrder: 0, hasFaculty: true },
        { id: "g-2", sortOrder: 1, hasFaculty: false },
        { id: "g-3", sortOrder: 2, hasFaculty: false },
      ],
      faculty("Ambuja", "Ravi")
    );
    expect(proposal).toEqual([
      { groupId: "g-2", facultyId: "f-1" },
      { groupId: "g-3", facultyId: "f-2" },
    ]);
  });

  it("re-proposes for every group when preserveExisting is false", () => {
    const proposal = computeBalancedFacultyProposal(
      [
        { id: "g-1", sortOrder: 0, hasFaculty: true },
        { id: "g-2", sortOrder: 1, hasFaculty: true },
      ],
      faculty("Ambuja", "Ravi"),
      { preserveExisting: false }
    );
    expect(proposal).toEqual([
      { groupId: "g-1", facultyId: "f-1" },
      { groupId: "g-2", facultyId: "f-2" },
    ]);
  });

  it("returns an empty proposal when every group already has faculty", () => {
    const proposal = computeBalancedFacultyProposal(
      groups(3, true),
      faculty("Ambuja", "Ravi")
    );
    expect(proposal).toEqual([]);
  });

  it("sorts groups by sortOrder before proposing", () => {
    const proposal = computeBalancedFacultyProposal(
      [
        { id: "g-z", sortOrder: 2, hasFaculty: false },
        { id: "g-a", sortOrder: 0, hasFaculty: false },
        { id: "g-m", sortOrder: 1, hasFaculty: false },
      ],
      faculty("Ambuja")
    );
    expect(proposal).toEqual([
      { groupId: "g-a", facultyId: "f-1" },
      { groupId: "g-m", facultyId: "f-1" },
      { groupId: "g-z", facultyId: "f-1" },
    ]);
  });
});

describe("assertFacultyReassignmentAllowed", () => {
  let assertFacultyReassignmentAllowed: typeof import("../faculty-distribution").assertFacultyReassignmentAllowed;

  beforeEach(async () => {
    const mod = await import("../faculty-distribution");
    assertFacultyReassignmentAllowed = mod.assertFacultyReassignmentAllowed;
  });

  it("resolves when no attendance or marks exist", async () => {
    hasAttendanceOrMarksResult = false;
    await expect(
      assertFacultyReassignmentAllowed("course-1")
    ).resolves.toBeUndefined();
  });

  it("throws once attendance or marks exist for the course", async () => {
    hasAttendanceOrMarksResult = true;
    await expect(assertFacultyReassignmentAllowed("course-1")).rejects.toThrow(
      "Faculty assignments cannot be modified after attendance or marks have been recorded for this course"
    );
  });
});
