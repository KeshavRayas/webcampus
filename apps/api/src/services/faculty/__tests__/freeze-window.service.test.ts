/// <reference types="bun" />

import { describe, expect, it, mock } from "bun:test";

const dbMock = {
  faculty: {
    findUnique: mock(async () => ({ id: "fac-1" })),
  },
  courseAssignment: {
    findMany: mock(async (): Promise<Array<Record<string, unknown>>> => []),
  },
  electiveBatchFaculty: {
    findMany: mock(async (): Promise<Array<Record<string, unknown>>> => []),
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {},
  CourseApprovalStatus: { PENDING: "PENDING", APPROVED: "APPROVED" },
}));
mock.module("@webcampus/common/logger", () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

const { FreezeService } = await import("../freeze.service");
const { FacultyAttendanceWindowService } = await import(
  "../faculty-attendance-window.service"
);

describe("FreezeService.getFacultyWindows (domain semantics)", () => {
  it("marks CourseAssignment rows as domain 'section'", async () => {
    dbMock.courseAssignment.findMany.mockImplementation(async () => [
      {
        id: "ca-1",
        semester: 3,
        assignmentType: "THEORY",
        course: { code: "CS301", name: "Algorithms" },
        department: { name: "CS" },
        faculty: { shortName: "Dr. A" },
        section: { id: "sec-a", name: "A" },
        batch: null,
        freezes: null,
      },
    ]);
    dbMock.electiveBatchFaculty.findMany.mockImplementation(async () => []);

    const rows = await FreezeService.getFacultyWindows("fac-1", "sem-1");

    expect(rows).toHaveLength(1);
    const pc = rows[0];
    expect(pc?.isElective).toBe(false);
    expect(pc?.domain).toBe("section");
    expect(pc?.sectionId).toBe("sec-a");
  });

  it("marks elective batch rows as domain 'group'", async () => {
    dbMock.courseAssignment.findMany.mockImplementation(async () => []);
    dbMock.electiveBatchFaculty.findMany.mockImplementation(async () => [
      {
        id: "ebf-1",
        semester: 3,
        course: {
          code: "PW101",
          name: "Project 101",
          department: { name: "CS" },
        },
        faculty: { shortName: "Dr. A" },
        electiveBatch: { id: "eb-g1", name: "G-001" },
        freeze: null,
      },
    ]);

    const rows = await FreezeService.getFacultyWindows("fac-1", "sem-1");

    expect(rows).toHaveLength(1);
    const group = rows[0];
    expect(group?.isElective).toBe(true);
    expect(group?.domain).toBe("group");
    expect(group?.sectionId).toBe("eb-g1");
    expect(group?.sectionName).toBe("G-001");
  });

  it("returns both domains together without mixing their sectionId namespaces", async () => {
    dbMock.courseAssignment.findMany.mockImplementation(async () => [
      {
        id: "ca-1",
        semester: 3,
        assignmentType: "THEORY",
        course: { code: "CS301", name: "Algorithms" },
        department: { name: "CS" },
        faculty: { shortName: "Dr. A" },
        section: { id: "sec-a", name: "A" },
        batch: null,
        freezes: null,
      },
    ]);
    dbMock.electiveBatchFaculty.findMany.mockImplementation(async () => [
      {
        id: "ebf-1",
        semester: 3,
        course: {
          code: "PW101",
          name: "Project 101",
          department: { name: "CS" },
        },
        faculty: { shortName: "Dr. A" },
        electiveBatch: { id: "eb-g1", name: "G-001" },
        freeze: null,
      },
    ]);

    const rows = await FreezeService.getFacultyWindows("fac-1", "sem-1");

    const pc = rows.find((r) => r.domain === "section");
    const group = rows.find((r) => r.domain === "group");
    expect(pc?.sectionId).toBe("sec-a");
    expect(group?.sectionId).toBe("eb-g1");
    expect(pc?.sectionId).not.toBe(group?.sectionId);
  });
});

describe("FacultyAttendanceWindowService.getSections (domain-tagged options)", () => {
  it("tags CourseAssignment sections as 'section' and elective batches as 'group'", async () => {
    dbMock.courseAssignment.findMany.mockImplementation(async () => [
      { sectionId: "sec-a", section: { id: "sec-a", name: "A" } },
    ]);
    dbMock.electiveBatchFaculty.findMany.mockImplementation(async () => [
      { electiveBatch: { id: "eb-g1", name: "G-001" } },
    ]);

    const sections = await FacultyAttendanceWindowService.getSections(
      "user-1",
      "sem-1"
    );

    expect(sections).toContainEqual({
      id: "sec-a",
      name: "A",
      domain: "section",
    });
    expect(sections).toContainEqual({
      id: "eb-g1",
      name: "G-001",
      domain: "group",
    });
  });
});
