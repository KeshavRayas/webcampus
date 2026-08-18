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
  student: {
    findUnique: async () => ({
      id: "s1",
      programType: "UG",
      user: { name: "Alice", image: null },
      admission: { photo: null },
    }),
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

  it("list flags a frozen student whose PE mapping is incomplete with a block reason", async () => {
    eligMock.findEligibleStudents.mockImplementation(async () => [
      FROZEN_STUDENT,
    ]);
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    const result = await hallTicketService.list({ academicTermId: "term-1" });
    expect(result).toHaveLength(1);
    expect(result[0]?.studentId).toBe("s1");
    expect(result[0]?.peReady).toBe(false);
    expect(result[0]?.blockReason).toBe("PE course mapping is not complete");
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

describe("hall-ticket PW PDF gate", () => {
  beforeEach(() => {
    gateMock.mockImplementation(async () => {});
    eligMock.getCourseEligibility.mockImplementation(
      async () => FROZEN_STUDENT
    );
    dbMock.courseRegistration.findMany = async () => [
      { courseId: "course-pe" },
    ];
  });

  it("generatePdfHtml succeeds for a fully ready PW course", async () => {
    dbMock.courseRegistration.findMany = async () => [
      { courseId: "course-pw" },
    ];

    const html = await hallTicketService.generatePdfHtml("s1", "term-1");
    expect(html).toContain("<html>");
  });

  it("generatePdfHtml is blocked when a PW course is not downstream ready", async () => {
    dbMock.courseRegistration.findMany = async () => [
      { courseId: "course-pw" },
    ];
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () =>
      hallTicketService.generatePdfHtml("s1", "term-1")
    ).toThrow(GATE_MESSAGE);
  });

  it("generatePdfHtml still succeeds for a ready PE course", async () => {
    const html = await hallTicketService.generatePdfHtml("s1", "term-1");
    expect(html).toContain("<html>");
  });

  it("generatePdfHtml is blocked for an incomplete PE course", async () => {
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    expect(async () =>
      hallTicketService.generatePdfHtml("s1", "term-1")
    ).toThrow(GATE_MESSAGE);
  });

  it("generatePdfHtml does not consult the downstream gate for OE", async () => {
    dbMock.courseRegistration.findMany = async () => [];
    gateMock.mockImplementation(async () => {
      throw new Error(GATE_MESSAGE);
    });

    const html = await hallTicketService.generatePdfHtml("s1", "term-1");
    expect(html).toContain("<html>");
  });
});
