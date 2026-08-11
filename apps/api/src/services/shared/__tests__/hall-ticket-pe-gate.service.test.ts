/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { academicEligibility as realAcademicEligibility } from "../academic-eligibility.service";

const gateMock = mock(async () => {});

const eligMock = {
  findEligibleStudents: mock<() => Promise<unknown[]>>(async () => []),
  getCourseEligibility: mock<() => Promise<unknown>>(async () => null),
};

const dbMock = {
  courseRegistration: {
    findMany: async () => [{ courseId: "course-pe" }],
  },
  academicTerm: {
    findUnique: async () => ({ year: 2026, type: "ODD" }),
  },
  hallTicket: {
    findMany: async () => [],
    findFirst: async () => null,
  },
  semester: {
    findUnique: async () => ({ id: "sem-1" }),
  },
};

mock.module("@webcampus/db", () => ({ db: dbMock, Prisma: {} }));
mock.module("@webcampus/common/logger", () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));
mock.module("@webcampus/api/src/services/shared/pe-capacity.service", () => ({
  PeCapacityService: { assertPeDownstreamReady: gateMock },
}));
mock.module(
  "@webcampus/api/src/services/shared/academic-eligibility.service",
  () => ({
    academicEligibility: {
      ...realAcademicEligibility,
      findEligibleStudents: eligMock.findEligibleStudents,
      getCourseEligibility: eligMock.getCourseEligibility,
    },
  })
);
mock.module("@webcampus/ui/lib/hall-ticket", () => ({
  hallTicketHtml: () => "<html></html>",
}));

const { hallTicketService } = await import("../hall-ticket.service");

const GATE_MESSAGE =
  "PE course CS101 requires both faculty mapping and elective student mapping before attendance, marks, or hall tickets.";

const FROZEN_STUDENT = {
  studentId: "s1",
  usn: "TBM26CS0001",
  name: "Alice",
  email: null,
  photo: null,
  departmentName: "CS",
  currentSemester: 1,
  programType: "UG",
  sectionName: "PA",
  courses: [],
  allCoursesFrozen: true,
  eligible: true,
};

describe("hall-ticket PE completeness gate", () => {
  beforeEach(() => {
    gateMock.mockImplementation(async () => {});
  });

  it("isStudentPeReady is false when the PE gate throws", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(await hallTicketService.isStudentPeReady("s1", "term-1")).toBe(
      false
    );
  });

  it("isStudentPeReady is true when the gate passes", async () => {
    expect(await hallTicketService.isStudentPeReady("s1", "term-1")).toBe(true);
  });

  it("list excludes a frozen student whose PE mapping is incomplete", async () => {
    eligMock.findEligibleStudents.mockImplementation(async () => [
      FROZEN_STUDENT,
    ]);
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    const result = await hallTicketService.list({ academicTermId: "term-1" });
    expect(result).toEqual([]);
  });

  it("list includes a frozen student when PE mapping is complete", async () => {
    eligMock.findEligibleStudents.mockImplementation(async () => [
      FROZEN_STUDENT,
    ]);

    const result = await hallTicketService.list({ academicTermId: "term-1" });
    expect(result).toHaveLength(1);
    expect(result[0]?.studentId).toBe("s1");
  });

  it("send reports an error for a student whose PE mapping is incomplete", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () =>
      hallTicketService.send(
        { studentIds: ["s1"], academicTermId: "term-1", semesterId: "sem-1" },
        "admin"
      )
    ).toThrow("PE course mapping is not complete");
  });

  it("getData returns null when PE mapping is incomplete", async () => {
    eligMock.getCourseEligibility.mockImplementation(
      async () => FROZEN_STUDENT
    );
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(await hallTicketService.getData("s1", "term-1")).toBeNull();
  });
});
