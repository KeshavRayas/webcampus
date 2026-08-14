/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

const gateMock = mock(async () => {});
const rosterMock = mock<() => Promise<Array<{ studentId: string }>>>(
  async () => []
);

function dataOf<T>(
  result:
    | { status: string; data?: T | null }
    | { status: string; message?: string }
): T | null {
  if (result.status !== "success") return null;
  const r = result as { data?: T | null };
  return r.data ?? null;
}

let batchFacultyAssigned = true;

const dbMock = {
  faculty: {
    findUnique: async () => ({ id: "fac-1" }),
  },
  course: {
    findUnique: async () => ({ courseType: "PE" }),
  },
  assessmentTemplate: {
    findUnique: async () => ({
      id: "assess-1",
      title: "IA-1",
      totalMarks: 50,
      courseId: "course-pe",
      semesterId: "sem-1",
      questions: [],
      course: {
        id: "course-pe",
        name: "PE 101",
        code: "PE101",
        courseType: "PE",
        approvalStatus: "APPROVED",
      },
    }),
    findMany: async () => [],
  },
  courseAssignment: {
    findFirst: async () => ({ freezes: null }),
    findMany: async () => [],
  },
  electiveBatchFaculty: {
    findFirst: async () => (batchFacultyAssigned ? { id: "ebf-1" } : null),
    findMany: async () => [],
  },
  student: {
    findMany: async () => [],
  },
  studentAssessment: {
    findMany: async () => [],
    upsert: async () => ({ id: "sa-1" }),
  },
  studentQuestionMark: {
    upsert: async () => ({ id: "sqm-1" }),
  },
  mark: {
    findMany: async () => [],
    upsert: async () => null,
  },
  courseRegistration: {
    findFirst: async () => null,
    findMany: async () => [],
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
  PeCapacityService: {
    assertPeDownstreamReady: gateMock,
    getFacultyPeRoster: rosterMock,
  },
}));
mock.module("@webcampus/api/src/services/shared/mark-sync.service", () => ({
  recomputeStudentMark: mock(async () => {}),
}));

const { Mark } = await import("../mark.service");

describe("Mark PE elective-batch roster scoping", () => {
  beforeEach(() => {
    gateMock.mockImplementation(async () => {});
    rosterMock.mockImplementation(async () => []);
    batchFacultyAssigned = true;
  });

  it("saveAssessmentMarks rejects a student outside the faculty's PE batches", async () => {
    rosterMock.mockImplementation(async () => [{ studentId: "stu-b1" }]);

    expect(async () =>
      Mark.saveAssessmentMarks("user-fac", {
        assessmentId: "assess-1",
        courseId: "course-pe",
        marks: [],
        studentTotals: [
          { studentId: "stu-outside", totalMarks: 30, status: "PRESENT" },
        ],
      } as never)
    ).toThrow(
      "Student stu-outside is not in any of your elective batches for this course"
    );
  });

  it("saveAssessmentMarks accepts students in any of the faculty's PE batches (multi-batch union)", async () => {
    rosterMock.mockImplementation(async () => [
      { studentId: "stu-b1" },
      { studentId: "stu-b2" },
    ]);

    const result = await Mark.saveAssessmentMarks("user-fac", {
      assessmentId: "assess-1",
      courseId: "course-pe",
      marks: [],
      studentTotals: [
        { studentId: "stu-b2", totalMarks: 35, status: "PRESENT" },
      ],
    } as never);

    expect(result.status).toBe("success");
  });

  it("getAssessmentTemplateWithMarks returns only the faculty's batch roster", async () => {
    rosterMock.mockImplementation(async () => [
      { studentId: "stu-b1" },
      { studentId: "stu-b2" },
    ]);
    (dbMock.student.findMany as unknown as ReturnType<typeof mock>) = mock(
      async () => [
        { id: "stu-b1", usn: "USN0001", user: { name: "Alice" } },
        { id: "stu-b2", usn: "USN0002", user: { name: "Bob" } },
      ]
    );

    const result = await Mark.getAssessmentTemplateWithMarks(
      "user-fac",
      "assess-1"
    );

    expect(result.status).toBe("success");
    const data = dataOf(result);
    expect(data?.students).toHaveLength(2);
    expect(data?.students.map((s) => s.usn).sort()).toEqual([
      "USN0001",
      "USN0002",
    ]);
  });

  it("getAssessmentTemplateWithMarks denies a faculty not assigned to any PE batch", async () => {
    batchFacultyAssigned = false;

    expect(async () =>
      Mark.getAssessmentTemplateWithMarks("user-fac", "assess-1")
    ).toThrow("Unauthorized to view this assessment");
  });

  it("getMarksDashboard returns PE assignments with a null section", async () => {
    (dbMock.electiveBatchFaculty.findMany as unknown as ReturnType<
      typeof mock
    >) = mock(async () => [
      {
        course: {
          id: "course-pe",
          code: "PE101",
          name: "PE 101",
          courseType: "PE",
          semester: {
            id: "sem-1",
            semesterNumber: 3,
            academicTerm: { id: "term-1", type: "ODD", year: 2026 },
          },
          assessments: [
            {
              id: "assess-1",
              title: "IA-1",
              totalMarks: 50,
              studentRecords: [{ id: "sr-1" }],
            },
          ],
        },
      },
    ]);

    const result = await Mark.getMarksDashboard("user-fac");

    expect(result.status).toBe("success");
    const data = dataOf<
      Array<{
        section: unknown;
        course: {
          code: string;
          courseType: string;
          assessments: Array<{ id: string; hasMarks: boolean }>;
        };
      }>
    >(result);
    expect(data).toHaveLength(1);
    const pe = data?.[0];
    expect(pe?.section).toBeNull();
    expect(pe?.course.code).toBe("PE101");
    expect(pe?.course.courseType).toBe("PE");
    expect(pe?.course.assessments[0]?.hasMarks).toBe(true);
  });

  it("getMarksReportFilterOptions includes PE courses with an empty section", async () => {
    (dbMock.electiveBatchFaculty.findMany as unknown as ReturnType<
      typeof mock
    >) = mock(async () => [
      {
        course: {
          id: "course-pe",
          code: "PE101",
          name: "PE 101",
          semesterId: "sem-1",
        },
      },
    ]);

    const result = await Mark.getMarksReportFilterOptions("user-fac");

    expect(result.status).toBe("success");
    const data = dataOf(result);
    const peCourse = data?.courses.find((c) => c.id === "course-pe");
    expect(peCourse).toBeDefined();
    expect(peCourse?.sectionId).toBe("");
    expect(peCourse?.sectionName).toBe("");
  });

  it("getMarksReport serves a PE course with the faculty's batch roster", async () => {
    rosterMock.mockImplementation(async () => [{ studentId: "stu-b1" }]);
    (dbMock.electiveBatchFaculty.findFirst as unknown as ReturnType<
      typeof mock
    >) = mock(async () => ({
      course: {
        id: "course-pe",
        code: "PE101",
        name: "PE 101",
        semesterId: "sem-1",
        cieEligibility: 40,
        cieMaxMarks: 100,
        approvalStatus: "APPROVED",
        semester: {
          id: "sem-1",
          semesterNumber: 3,
          academicTerm: { id: "term-1", type: "ODD", year: 2026 },
        },
      },
    }));
    (dbMock.student.findMany as unknown as ReturnType<typeof mock>) = mock(
      async () => [{ id: "stu-b1", usn: "USN0001", user: { name: "Alice" } }]
    );

    const result = await Mark.getMarksReport("user-fac", "course-pe");

    expect(result.status).toBe("success");
    const data = dataOf(result);
    expect(data?.students).toHaveLength(1);
    expect(data?.students[0]?.usn).toBe("USN0001");
  });

  it("getMarksReport denies a PE course the faculty does not teach", async () => {
    rosterMock.mockImplementation(async () => []);
    (dbMock.electiveBatchFaculty.findFirst as unknown as ReturnType<
      typeof mock
    >) = mock(async () => null);

    expect(async () => Mark.getMarksReport("user-fac", "course-pe")).toThrow(
      "Unauthorized to view this course"
    );
  });

  it("getMarksReport serves an OE course via its real course type", async () => {
    (dbMock.course.findUnique as unknown as ReturnType<typeof mock>) = mock(
      async () => ({ courseType: "OE" })
    );
    rosterMock.mockImplementation(async () => [{ studentId: "stu-b1" }]);
    (dbMock.electiveBatchFaculty.findFirst as unknown as ReturnType<
      typeof mock
    >) = mock(async () => ({
      course: {
        id: "course-oe",
        code: "OE101",
        name: "OE 101",
        semesterId: "sem-1",
        cieEligibility: 40,
        cieMaxMarks: 100,
        approvalStatus: "APPROVED",
        semester: {
          id: "sem-1",
          semesterNumber: 3,
          academicTerm: { id: "term-1", type: "ODD", year: 2026 },
        },
      },
    }));
    (dbMock.student.findMany as unknown as ReturnType<typeof mock>) = mock(
      async () => [{ id: "stu-b1", usn: "USN0001", user: { name: "Alice" } }]
    );

    const result = await Mark.getMarksReport("user-fac", "course-oe");

    expect(result.status).toBe("success");
    const data = dataOf(result);
    expect(data?.students).toHaveLength(1);
    expect(data?.students[0]?.usn).toBe("USN0001");
  });

  it("getMarksDashboard includes electiveBatchId: null on PC section rows", async () => {
    (dbMock.courseAssignment.findMany as unknown as ReturnType<typeof mock>) =
      mock(async () => [
        {
          section: { id: "sec-a", name: "A", semesterId: "sem-1" },
          course: {
            id: "course-pc",
            code: "PC101",
            name: "PC 101",
            courseType: "PC",
            semester: {
              id: "sem-1",
              semesterNumber: 3,
              academicTerm: { id: "term-1", type: "ODD", year: 2026 },
            },
            assessments: [
              {
                id: "assess-1",
                title: "IA-1",
                totalMarks: 50,
                studentRecords: [{ id: "sr-1" }],
              },
            ],
          },
        },
      ]);
    (dbMock.electiveBatchFaculty.findMany as unknown as ReturnType<
      typeof mock
    >) = mock(async () => []);

    const result = await Mark.getMarksDashboard("user-fac");

    expect(result.status).toBe("success");
    const data =
      dataOf<
        Array<{
          electiveBatchId: unknown;
          electiveBatchName: unknown;
          course: { courseType: string };
        }>
      >(result);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.electiveBatchId).toBeNull();
    expect(data?.[0]?.electiveBatchName).toBeNull();
    expect(data?.[0]?.course.courseType).toBe("PC");
  });

  it("getMarksReportFilterOptions carries the PE course type on elective batch rows", async () => {
    (dbMock.electiveBatchFaculty.findMany as unknown as ReturnType<
      typeof mock
    >) = mock(async () => [
      {
        course: {
          id: "course-pe",
          code: "PE101",
          name: "PE 101",
          courseType: "PE",
          semesterId: "sem-1",
        },
        electiveBatch: { id: "eb-g1", name: "G-001" },
      },
    ]);

    const result = await Mark.getMarksReportFilterOptions("user-fac");

    expect(result.status).toBe("success");
    const data = dataOf(result);
    const peCourse = data?.courses.find((c) => c.id === "course-pe");
    expect(peCourse).toBeDefined();
    expect(peCourse?.courseType).toBe("PE");
    expect(peCourse?.sectionId).toBe("eb-g1");
    expect(peCourse?.isElectiveBatch).toBe(true);
  });

  it("getMarksReportFilterOptions carries the PC course type on section rows", async () => {
    (dbMock.courseAssignment.findMany as unknown as ReturnType<typeof mock>) =
      mock(async () => [
        {
          course: {
            id: "course-pc",
            code: "PC101",
            name: "PC 101",
            courseType: "PC",
            semesterId: "sem-1",
          },
          section: { id: "sec-a", name: "A" },
        },
      ]);
    (dbMock.electiveBatchFaculty.findMany as unknown as ReturnType<
      typeof mock
    >) = mock(async () => []);

    const result = await Mark.getMarksReportFilterOptions("user-fac");

    expect(result.status).toBe("success");
    const data = dataOf(result);
    const pcCourse = data?.courses.find((c) => c.id === "course-pc");
    expect(pcCourse).toBeDefined();
    expect(pcCourse?.courseType).toBe("PC");
    expect(pcCourse?.sectionId).toBe("sec-a");
    expect(pcCourse?.isElectiveBatch).toBe(false);
  });
});
