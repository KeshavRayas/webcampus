/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

const gateMock = mock(async () => {});

const dbMock = {
  attendance: {
    findFirst: async () => null,
    findUnique: async () => ({
      id: "att-1",
      courseId: "course-pe",
      course: { assignments: [] },
    }),
    create: async (args: unknown) => ({
      ...(args as { data: object }).data,
      id: "att-1",
    }),
    update: async (args: unknown) => ({
      ...(args as { data: object }).data,
      id: "att-1",
    }),
    delete: async () => null,
  },
  course: {
    findUnique: async () => ({ assignments: [] }),
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

const { Attendance } = await import("../attendance.service");

const GATE_MESSAGE =
  "PE course CS101 requires both faculty mapping and elective student mapping before attendance, marks, or hall tickets.";

describe("Attendance PE completeness gate", () => {
  beforeEach(() => {
    gateMock.mockImplementation(async () => {});
  });

  it("create rejects when the PE mapping gate throws", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () =>
      Attendance.create({
        studentId: "stu-1",
        courseId: "course-pe",
        percentage: 80,
      } as never)
    ).toThrow(GATE_MESSAGE);
  });

  it("create proceeds when the gate passes", async () => {
    const result = await Attendance.create({
      studentId: "stu-1",
      courseId: "course-1",
      percentage: 80,
    } as never);

    expect(result.status).toBe("success");
  });

  it("update rejects when the PE mapping gate throws", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () =>
      Attendance.update("att-1", { percentage: 85 } as never)
    ).toThrow(GATE_MESSAGE);
  });

  it("update proceeds when the gate passes", async () => {
    const result = await Attendance.update("att-1", {
      percentage: 85,
    } as never);
    expect(result.status).toBe("success");
  });

  it("delete rejects when the PE mapping gate throws", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () => Attendance.delete("att-1")).toThrow(GATE_MESSAGE);
  });

  it("delete proceeds when the gate passes", async () => {
    const result = await Attendance.delete("att-1");
    expect(result.status).toBe("success");
  });
});
