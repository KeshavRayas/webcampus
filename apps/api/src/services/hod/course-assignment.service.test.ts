/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

let sectionDepartmentId = "dep-a";
let courseDepartmentId = "dep-b";
let facultyDepartmentId = "dep-a";
let createCalls = 0;

const dbMock = {
  section: {
    findUnique: async () => ({ departmentId: sectionDepartmentId }),
  },
  course: {
    findUnique: async () => ({ departmentId: courseDepartmentId }),
  },
  faculty: {
    findUnique: async () => ({ departmentId: facultyDepartmentId }),
  },
  courseAssignment: {
    create: async () => {
      createCalls += 1;
      return {
        id: "ca-1",
        courseId: "course-1",
        sectionId: "section-1",
        facultyId: "faculty-1",
        assignmentType: "THEORY",
      };
    },
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code = "";
    },
  },
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
  },
}));

describe("HOD CourseAssignment cross-department invariants", () => {
  beforeEach(() => {
    sectionDepartmentId = "dep-a";
    courseDepartmentId = "dep-b";
    facultyDepartmentId = "dep-a";
    createCalls = 0;
  });

  it("rejects linking a course to a section from another department", async () => {
    const { CourseAssignment } = await import("./course-assignment.service");

    await expect(
      CourseAssignment.create({
        courseId: "course-1",
        sectionId: "section-1",
        facultyId: "faculty-1",
        assignmentType: "THEORY",
        semester: 3,
        academicYear: "2025-26",
      })
    ).rejects.toThrow("Course and section must belong to the same department");

    expect(createCalls).toBe(0);
  });

  it("rejects linking faculty from a different department even when section and course match", async () => {
    const { CourseAssignment } = await import("./course-assignment.service");

    courseDepartmentId = "dep-a";
    facultyDepartmentId = "dep-z";

    await expect(
      CourseAssignment.create({
        courseId: "course-1",
        sectionId: "section-1",
        facultyId: "faculty-1",
        assignmentType: "THEORY",
        semester: 3,
        academicYear: "2025-26",
      })
    ).rejects.toThrow(
      "Faculty, course, and section must belong to the same department"
    );

    expect(createCalls).toBe(0);
  });
});
