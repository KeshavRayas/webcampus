/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

const gateMock = mock(async () => {});

const dbMock = {
  faculty: {
    findUnique: async () => ({ id: "fac-1" }),
  },
  mark: {
    findUnique: async (args: unknown) => {
      const where = (args as { where: object }).where as Record<
        string,
        unknown
      >;
      if (where?.studentId_courseId) {
        return null;
      }
      return {
        id: "mark-1",
        courseId: "course-pe",
        course: { approvalStatus: "APPROVED", assignments: [] },
      };
    },
    create: async (args: unknown) => ({
      ...(args as { data: object }).data,
      id: "mark-1",
    }),
    update: async (args: unknown) => ({
      ...(args as { data: object }).data,
      id: (args as { where: { id: string } }).where.id,
    }),
    delete: async () => null,
  },
  courseAssignment: {
    findFirst: async (): Promise<{ id: string } | null> => ({ id: "ca-1" }),
  },
  electiveBatchFaculty: {
    findFirst: async () => null,
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {},
  CourseApprovalStatus: { PENDING: "PENDING", APPROVED: "APPROVED" },
  EligibilityStatus: { ELIGIBLE: "ELIGIBLE", NOT_ELIGIBLE: "NOT_ELIGIBLE" },
}));
mock.module("@webcampus/common/logger", () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));
mock.module("@webcampus/api/src/services/shared/pe-capacity.service", () => ({
  PeCapacityService: { assertPeDownstreamReady: gateMock },
}));

const { Mark } = await import("../mark.service");

const GATE_MESSAGE =
  "PE course CS101 requires both faculty mapping and elective student mapping before attendance, marks, or hall tickets.";

const MARK_PAYLOAD = {
  studentId: "stu-1",
  courseId: "course-pe",
  cieTotal: 40,
  status: "ELIGIBLE",
};

describe("Mark generic CRUD PE gate + faculty verification", () => {
  beforeEach(() => {
    gateMock.mockImplementation(async () => {});
    dbMock.courseAssignment.findFirst = async () => ({ id: "ca-1" });
  });

  it("create rejects when the PE mapping gate throws", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () => Mark.create(MARK_PAYLOAD as never, "user-fac")).toThrow(
      GATE_MESSAGE
    );
  });

  it("create rejects a faculty not assigned to the course", async () => {
    dbMock.courseAssignment.findFirst = async () => null;

    expect(async () => Mark.create(MARK_PAYLOAD as never, "user-fac")).toThrow(
      "Unauthorized to manage marks for this course"
    );
  });

  it("create proceeds when gate passes and faculty is assigned", async () => {
    const result = await Mark.create(MARK_PAYLOAD as never, "user-fac");
    expect(result.status).toBe("success");
  });

  it("update rejects when the PE mapping gate throws", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () =>
      Mark.update("mark-1", { cieTotal: 50 }, "user-fac")
    ).toThrow(GATE_MESSAGE);
  });

  it("update proceeds when the gate passes", async () => {
    const result = await Mark.update("mark-1", { cieTotal: 50 }, "user-fac");
    expect(result.status).toBe("success");
  });

  it("delete rejects when the PE mapping gate throws", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () => Mark.delete("mark-1", "user-fac")).toThrow(GATE_MESSAGE);
  });

  it("delete proceeds when the gate passes", async () => {
    const result = await Mark.delete("mark-1", "user-fac");
    expect(result.status).toBe("success");
  });
});
