/// <reference types="bun" />

import { describe, expect, it, mock } from "bun:test";

const dbMock = {
  courseAssignment: {
    findMany: mock(
      async (args?: {
        where?: Record<string, unknown>;
      }): Promise<Array<Record<string, unknown>>> => {
        void args;
        return [];
      }
    ),
  },
  electiveBatchFaculty: {
    findMany: mock(
      async (args?: {
        where?: Record<string, unknown>;
      }): Promise<Array<Record<string, unknown>>> => {
        void args;
        return [];
      }
    ),
  },
  feedbackRound: {
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

const { FeedbackService } = await import("../feedback.service");

describe("FeedbackService.getFilterOptions (faculty scope)", () => {
  it("includes PE/OE/PW courses and groups for a faculty with only elective assignments", async () => {
    dbMock.courseAssignment.findMany.mockImplementation(async () => []);
    dbMock.electiveBatchFaculty.findMany.mockImplementation(async () => [
      {
        faculty: {
          id: "fac-1",
          shortName: "Dr. A",
          user: { name: "Ambuja" },
        },
        course: { id: "course-pw", code: "PW101", name: "Project 101" },
        electiveBatch: { id: "eb-g1", name: "G-001" },
      },
    ]);
    dbMock.feedbackRound.findMany.mockImplementation(async () => [
      { id: "round-1", roundNumber: 1, name: "Round 1" },
    ]);

    const result = await FeedbackService.getFilterOptions(
      { role: "faculty", facultyId: "fac-1" },
      { semesterId: "sem-1" }
    );

    expect(result).toBeDefined();
    const courses = result.courses as Array<{ id: string; code: string }>;
    const sections = result.sections as Array<{
      id: string;
      name: string;
      isElectiveBatch?: boolean;
    }>;
    const faculty = result.faculty as Array<{ id: string }>;

    expect(courses.map((c) => c.id)).toContain("course-pw");
    expect(sections.map((s) => s.id)).toContain("eb-g1");
    const group = sections.find((s) => s.id === "eb-g1");
    expect(group?.name).toBe("G-001");
    expect(group?.isElectiveBatch).toBe(true);
    expect(faculty.map((f) => f.id)).toContain("fac-1");
  });

  it("merges elective groups into sections while labelling them as groups", async () => {
    dbMock.courseAssignment.findMany.mockImplementation(async () => [
      {
        faculty: { id: "fac-1", shortName: "Dr. A", user: { name: "Ambuja" } },
        course: { id: "course-pc", code: "CS301", name: "Algorithms" },
        section: { id: "sec-a", name: "A" },
        batch: null,
        department: { id: "dept-cs", name: "Computer Science" },
      },
    ]);
    dbMock.electiveBatchFaculty.findMany.mockImplementation(async () => [
      {
        faculty: { id: "fac-1", shortName: "Dr. A", user: { name: "Ambuja" } },
        course: { id: "course-pw", code: "PW101", name: "Project 101" },
        electiveBatch: { id: "eb-g1", name: "G-001" },
      },
    ]);
    dbMock.feedbackRound.findMany.mockImplementation(async () => []);

    const result = await FeedbackService.getFilterOptions(
      { role: "faculty", facultyId: "fac-1" },
      {}
    );

    const sections = result.sections as Array<{
      id: string;
      name: string;
      isElectiveBatch?: boolean;
    }>;
    expect(sections.find((s) => s.id === "sec-a")?.isElectiveBatch).toBe(false);
    expect(sections.find((s) => s.id === "eb-g1")?.isElectiveBatch).toBe(true);
    expect(
      (result.courses as Array<{ id: string }>).map((c) => c.id).sort()
    ).toEqual(["course-pc", "course-pw"]);
  });

  it("scopes the CourseAssignment query to the selected course when courseId is provided", async () => {
    let lastWhere: Record<string, unknown> | undefined;
    dbMock.courseAssignment.findMany.mockImplementation(
      async (args: { where?: Record<string, unknown> } | undefined) => {
        lastWhere = args?.where;
        return [];
      }
    );
    dbMock.electiveBatchFaculty.findMany.mockImplementation(async () => []);
    dbMock.feedbackRound.findMany.mockImplementation(async () => []);

    await FeedbackService.getFilterOptions(
      { role: "faculty", facultyId: "fac-1" },
      { semesterId: "sem-1", courseId: "course-e1" }
    );

    const where = lastWhere as
      | { courseId?: string; course?: { id?: string } }
      | undefined;
    expect(where?.courseId).toBe("course-e1");
  });

  it("scopes the electiveBatchFaculty query to the selected course when courseId is provided", async () => {
    let lastWhere: Record<string, unknown> | undefined;
    dbMock.courseAssignment.findMany.mockImplementation(async () => []);
    dbMock.electiveBatchFaculty.findMany.mockImplementation(
      async (args: { where?: Record<string, unknown> } | undefined) => {
        lastWhere = args?.where;
        return [];
      }
    );
    dbMock.feedbackRound.findMany.mockImplementation(async () => []);

    await FeedbackService.getFilterOptions(
      { role: "faculty", facultyId: "fac-1" },
      { semesterId: "sem-1", courseId: "course-p1" }
    );

    const where = lastWhere as { course?: { id?: string } } | undefined;
    expect(where?.course?.id).toBe("course-p1");
  });

  it("preserves faculty-wide behavior when courseId is absent", async () => {
    let assignmentWhere: Record<string, unknown> | undefined;
    let electiveWhere: Record<string, unknown> | undefined;
    dbMock.courseAssignment.findMany.mockImplementation(
      async (args: { where?: Record<string, unknown> } | undefined) => {
        assignmentWhere = args?.where;
        return [];
      }
    );
    dbMock.electiveBatchFaculty.findMany.mockImplementation(
      async (args: { where?: Record<string, unknown> } | undefined) => {
        electiveWhere = args?.where;
        return [];
      }
    );
    dbMock.feedbackRound.findMany.mockImplementation(async () => []);

    await FeedbackService.getFilterOptions(
      { role: "faculty", facultyId: "fac-1" },
      { semesterId: "sem-1" }
    );

    const aWhere = assignmentWhere as
      | { courseId?: string; course?: { id?: string } }
      | undefined;
    const eWhere = electiveWhere as { course?: { id?: string } } | undefined;
    expect(aWhere?.courseId).toBeUndefined();
    expect(eWhere?.course?.id).toBeUndefined();
  });
});
