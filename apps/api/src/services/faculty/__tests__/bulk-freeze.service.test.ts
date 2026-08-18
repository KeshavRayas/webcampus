/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

const openFreeze = {
  displayState: "OPEN",
  lockedBy: null,
  frozenBy: {
    frozenByRole: null,
    frozenByUsername: null,
    frozenByDisplay: null,
  },
  frozenAt: null,
  message: null,
};

let rows: Array<Record<string, unknown>> = [];
const freezeCalls: Array<Record<string, unknown>> = [];

const dbMock = {
  faculty: {
    findUnique: mock(async () => ({ id: "fac-1" })),
  },
  academicTerm: {
    findUnique: mock(async () => ({ id: "term-1", isCurrent: true })),
  },
  semester: {
    findUnique: mock(async () => ({
      id: "sem-1",
      academicTermId: "term-1",
    })),
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
mock.module("@webcampus/api/src/services/faculty/freeze.service", () => ({
  FreezeService: {
    getFacultyWindows: mock(async () => rows),
    freeze: mock(async (input: Record<string, unknown>) => {
      freezeCalls.push(input);
      return { id: "f-1" };
    }),
  },
}));

const { FacultyAttendanceWindowService } = await import(
  "../faculty-attendance-window.service"
);

const makeRow = (over: Record<string, unknown>) => ({
  courseAssignmentId: null,
  electiveBatchFacultyId: null,
  isElective: false,
  domain: "section",
  courseCode: "CS301",
  courseName: "Algorithms",
  department: "CS",
  facultyName: "Dr. A",
  semester: 3,
  sectionId: "sec-a",
  sectionName: "A",
  batchName: null,
  assignmentType: "THEORY",
  freeze: openFreeze,
  ...over,
});

describe("FacultyAttendanceWindowService.bulkFreeze (domain-aware)", () => {
  beforeEach(() => {
    rows = [];
    freezeCalls.length = 0;
  });

  it("sectionId freezes only non-elective rows in that section", async () => {
    rows = [
      makeRow({
        courseAssignmentId: "ca-1",
        sectionId: "sec-a",
        domain: "section",
      }),
      makeRow({
        electiveBatchFacultyId: "ebf-1",
        isElective: true,
        domain: "group",
        sectionId: "eb-g1",
        sectionName: "G-001",
      }),
    ];

    const result = await FacultyAttendanceWindowService.bulkFreeze("user-1", {
      academicTermId: "term-1",
      semesterId: "sem-1",
      sectionId: "sec-a",
    } as never);

    expect(result.status).toBe("success");
    if (result.status === "error" || !result.data) {
      throw new Error("Expected success response with data");
    }
    expect(result.data.processed).toBe(1);
    expect(freezeCalls).toEqual([{ courseAssignmentId: "ca-1" }]);
  });

  it("electiveBatchId freezes only elective rows in that group", async () => {
    rows = [
      makeRow({
        courseAssignmentId: "ca-1",
        sectionId: "sec-a",
        domain: "section",
      }),
      makeRow({
        electiveBatchFacultyId: "ebf-1",
        isElective: true,
        domain: "group",
        sectionId: "eb-g1",
        sectionName: "G-001",
      }),
      makeRow({
        electiveBatchFacultyId: "ebf-2",
        isElective: true,
        domain: "group",
        sectionId: "eb-g2",
        sectionName: "G-002",
      }),
    ];

    const result = await FacultyAttendanceWindowService.bulkFreeze("user-1", {
      academicTermId: "term-1",
      semesterId: "sem-1",
      electiveBatchId: "eb-g1",
    } as never);

    expect(result.status).toBe("success");
    if (result.status === "error" || !result.data) {
      throw new Error("Expected success response with data");
    }
    expect(result.data.processed).toBe(1);
    expect(freezeCalls).toEqual([{ electiveBatchFacultyId: "ebf-1" }]);
  });

  it("with no scope filter, freezes every OPEN row across both domains", async () => {
    rows = [
      makeRow({ courseAssignmentId: "ca-1", domain: "section" }),
      makeRow({
        electiveBatchFacultyId: "ebf-1",
        isElective: true,
        domain: "group",
        sectionId: "eb-g1",
      }),
    ];

    const result = await FacultyAttendanceWindowService.bulkFreeze("user-1", {
      academicTermId: "term-1",
      semesterId: "sem-1",
    } as never);

    expect(result.status).toBe("success");
    if (result.status === "error" || !result.data) {
      throw new Error("Expected success response with data");
    }
    expect(result.data.processed).toBe(2);
    expect(freezeCalls).toHaveLength(2);
  });
});
