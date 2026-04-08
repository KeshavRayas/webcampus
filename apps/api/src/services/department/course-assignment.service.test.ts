/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

let explicitDepartment: {
  id: string;
  name: string;
  type: string;
  abbreviation: string;
} | null;
let sessionDepartment: {
  id: string;
  name: string;
  type: string;
  abbreviation: string;
} | null;
let courseFindManyCalls = 0;

const dbMock = {
  department: {
    findUnique: async () => explicitDepartment,
    findFirst: async () => sessionDepartment,
  },
  course: {
    findMany: async () => {
      courseFindManyCalls += 1;
      return [];
    },
  },
  semester: {
    findUnique: async () => ({ semesterNumber: 3 }),
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {},
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
  },
}));

mock.module(
  "@webcampus/api/src/services/shared/department-context-resolver.service",
  () => ({
    DepartmentContextResolver: {
      resolve: async (input: { departmentId?: string }) => ({
        departmentId: input.departmentId ?? "dep-explicit",
        departmentName: "Explicit Department",
      }),
    },
  })
);

describe("CourseAssignmentService department ownership guard", () => {
  beforeEach(() => {
    explicitDepartment = {
      id: "dep-explicit",
      name: "Explicit Department",
      type: "ENGINEERING",
      abbreviation: "ED",
    };
    sessionDepartment = {
      id: "dep-session",
      name: "Session Department",
      type: "ENGINEERING",
      abbreviation: "SD",
    };
    courseFindManyCalls = 0;
  });

  it("rejects non-admin explicit department override when it mismatches session department", async () => {
    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.getMappingStatus(
        "sem-1",
        "2025-26",
        "user-1",
        undefined,
        {
          departmentId: "dep-explicit",
          requesterRole: "department",
        }
      )
    ).rejects.toThrow("Forbidden: department scope mismatch");

    expect(courseFindManyCalls).toBe(0);
  });
});
