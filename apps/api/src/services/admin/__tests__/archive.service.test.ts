import type { BaseResponse } from "@webcampus/types/api";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ArchiveService } from "../archive.service";

// Narrows the BaseResponse union; assumes the caller already asserted success.
const dataOf = <T>(result: BaseResponse<T>): T | null => {
  if (result.status !== "success") {
    throw new Error(`expected success response, got: ${result.status}`);
  }
  return result.data;
};

// Mutable fixture state referenced by the db mock closures.
type MockRow = Record<string, unknown>;

const archivedBatches: MockRow[] = [];
const archivedBatchFaculties: MockRow[] = [];
const archivedAssignments: MockRow[] = [];
const archivedDepartments: MockRow[] = [];

let semesterEndDate = new Date("2020-06-01");
let electiveBatchRows: MockRow[] = [];
let electiveBatchFacultyRows: MockRow[] = [];
let electiveAssignmentRows: MockRow[] = [];
let archivedSemesterRecord: MockRow | null = null;

const dbMock = {
  semester: {
    findUnique: async () => ({
      id: "semester-1",
      semesterNumber: 3,
      programType: "UG",
      academicTermId: "term-1",
      academicTerm: { type: "ODD", year: "2026" },
      startDate: new Date("2020-01-01"),
      endDate: semesterEndDate,
    }),
  },
  archivedSemester: {
    findFirst: async () => archivedSemesterRecord,
    findMany: async () => [
      {
        originalId: "semester-1",
        semesterNumber: 3,
        programType: "UG",
        academicTermType: "ODD",
        academicTermYear: "2026",
        archivedAt: new Date(),
        archivedBy: "SYSTEM",
      },
    ],
  },
  department: {
    findMany: async () => [
      {
        id: "dept-1",
        name: "CSE",
        code: "CS",
        abbreviation: "CSE",
        type: "DEGREE_GRANTING",
        userMemberships: [],
        hods: [],
      },
    ],
  },
  faculty: {
    findMany: async () => [],
  },
  admin: {
    findMany: async () => [],
  },
  electiveBatch: {
    findMany: async () => electiveBatchRows,
  },
  electiveBatchFaculty: {
    findMany: async () => electiveBatchFacultyRows,
  },
  electiveStudentAssignment: {
    findMany: async () => electiveAssignmentRows,
  },
  archivedElectiveBatch: { count: async () => electiveBatchRows.length },
  archivedElectiveBatchFaculty: {
    count: async () => electiveBatchFacultyRows.length,
  },
  archivedElectiveAssignment: {
    count: async () => electiveAssignmentRows.length,
  },
  archivedDepartment: { count: async () => archivedDepartments.length },
  archivedFaculty: { count: async () => 0 },
  archivedAdmin: { count: async () => 0 },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      archivedSemester: {
        create: async ({ data }: { data: MockRow }) => ({
          id: "arch-sem-1",
          ...data,
        }),
      },
      archivedDepartment: {
        create: async ({ data }: { data: MockRow }) => {
          archivedDepartments.push(data);
          return { id: `arch-dept-${archivedDepartments.length}`, ...data };
        },
      },
      archivedFaculty: {
        create: async ({ data }: { data: MockRow }) => ({
          id: "arch-fac-1",
          ...data,
        }),
      },
      archivedAdmin: {
        create: async ({ data }: { data: MockRow }) => ({
          id: "arch-adm-1",
          ...data,
        }),
      },
      archivedElectiveBatch: {
        create: async ({ data }: { data: MockRow }) => {
          archivedBatches.push(data);
          return { id: "arch-batch-1", ...data };
        },
      },
      archivedElectiveBatchFaculty: {
        create: async ({ data }: { data: MockRow }) => {
          archivedBatchFaculties.push(data);
          return { id: "arch-bf-1", ...data };
        },
      },
      archivedElectiveAssignment: {
        create: async ({ data }: { data: MockRow }) => {
          archivedAssignments.push(data);
          return { id: "arch-assign-1", ...data };
        },
      },
    };
    return callback(tx);
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
  },
}));

const seedPeRows = () => {
  electiveBatchRows = [
    {
      id: "batch-1",
      courseId: "course-pe",
      name: "PE101 1",
      sortOrder: 1,
      createdAt: new Date("2020-01-10"),
      updatedAt: new Date("2020-01-10"),
      course: {
        id: "course-pe",
        code: "PE101",
        name: "PE Subject",
        departmentId: "dept-1",
      },
    },
  ];
  electiveBatchFacultyRows = [
    {
      id: "bf-1",
      courseId: "course-pe",
      facultyId: "fac-1",
      semester: 3,
      academicYear: "2026",
      course: {
        id: "course-pe",
        code: "PE101",
        name: "PE Subject",
        departmentId: "dept-1",
      },
      faculty: { id: "fac-1", shortName: "Dr. Smith" },
      electiveBatch: { id: "batch-1", name: "PE101 1" },
    },
  ];
  electiveAssignmentRows = [
    {
      id: "assign-1",
      courseId: "course-pe",
      studentId: "student-1",
      course: {
        id: "course-pe",
        code: "PE101",
        name: "PE Subject",
        departmentId: "dept-1",
      },
      student: { id: "student-1", usn: "TBM26CS0001", user: { name: "Alice" } },
      electiveBatch: { id: "batch-1", name: "PE101 1" },
    },
  ];
};

describe("ArchiveService.archiveSemester", () => {
  beforeEach(() => {
    archivedBatches.length = 0;
    archivedBatchFaculties.length = 0;
    archivedAssignments.length = 0;
    archivedDepartments.length = 0;
    electiveBatchRows = [];
    electiveBatchFacultyRows = [];
    electiveAssignmentRows = [];
    semesterEndDate = new Date("2020-06-01");
  });

  test("rejects semesters that are not yet past their end date", async () => {
    semesterEndDate = new Date("2100-06-01");

    await expect(ArchiveService.archiveSemester("semester-1")).rejects.toThrow(
      "Semester is not yet archived"
    );
  });

  test("snapshots elective batches, batch faculty, and student assignments inside the transaction", async () => {
    seedPeRows();

    const result = await ArchiveService.archiveSemester(
      "semester-1",
      "admin-1"
    );

    expect(result.status).toBe("success");
    const data = dataOf(result);
    expect(data?.archivedCounts).toEqual({
      departments: 1,
      faculty: 0,
      admins: 0,
      electiveBatches: 1,
      electiveBatchFaculties: 1,
      electiveAssignments: 1,
    });

    expect(archivedBatches).toHaveLength(1);
    expect(archivedBatches[0]).toMatchObject({
      originalId: "batch-1",
      courseId: "course-pe",
      courseCode: "PE101",
      courseName: "PE Subject",
      name: "PE101 1",
      sortOrder: 1,
      semesterId: "semester-1",
      archivedDepartmentId: "arch-dept-1",
      archivedBy: "admin-1",
    });

    expect(archivedBatchFaculties).toHaveLength(1);
    expect(archivedBatchFaculties[0]).toMatchObject({
      originalId: "bf-1",
      courseCode: "PE101",
      batchName: "PE101 1",
      facultyId: "fac-1",
      facultyName: "Dr. Smith",
      semester: 3,
      academicYear: "2026",
      archivedDepartmentId: "arch-dept-1",
    });

    expect(archivedAssignments).toHaveLength(1);
    expect(archivedAssignments[0]).toMatchObject({
      originalId: "assign-1",
      courseCode: "PE101",
      batchName: "PE101 1",
      studentId: "student-1",
      usn: "TBM26CS0001",
      studentName: "Alice",
      archivedDepartmentId: "arch-dept-1",
    });
  });

  test("archives a semester with no elective data without error and reports zero counts", async () => {
    const result = await ArchiveService.archiveSemester("semester-1");

    expect(result.status).toBe("success");
    const data = dataOf(result);
    expect(data?.archivedCounts).toEqual({
      departments: 1,
      faculty: 0,
      admins: 0,
      electiveBatches: 0,
      electiveBatchFaculties: 0,
      electiveAssignments: 0,
    });
    expect(archivedBatches).toHaveLength(0);
    expect(archivedBatchFaculties).toHaveLength(0);
    expect(archivedAssignments).toHaveLength(0);
  });
});

describe("ArchiveService.getArchiveSummary", () => {
  beforeEach(() => {
    archivedBatches.length = 0;
    archivedBatchFaculties.length = 0;
    archivedAssignments.length = 0;
    archivedSemesterRecord = {
      originalId: "semester-1",
      semesterNumber: 3,
      programType: "UG",
      academicTermType: "ODD",
      academicTermYear: "2026",
      archivedAt: new Date(),
      archivedBy: "SYSTEM",
    };
  });

  test("includes elective counts in the summary", async () => {
    seedPeRows();

    const result = await ArchiveService.getArchiveSummary("semester-1");

    expect(result.status).toBe("success");
    const data = dataOf(result);
    expect(data?.counts).toEqual({
      departments: 1,
      faculty: 0,
      admins: 0,
      electiveBatches: 1,
      electiveBatchFaculties: 1,
      electiveAssignments: 1,
    });
  });

  test("returns null when no archive exists for the semester", async () => {
    archivedSemesterRecord = null;

    const result = await ArchiveService.getArchiveSummary("unknown-semester");

    expect(result.status).toBe("success");
    expect(dataOf(result)).toBeNull();
  });
});

describe("ArchiveService.getAllArchives", () => {
  beforeEach(() => {
    archivedBatches.length = 0;
    archivedBatchFaculties.length = 0;
    archivedAssignments.length = 0;
  });

  test("includes elective counts for each archived semester", async () => {
    seedPeRows();

    const result = await ArchiveService.getAllArchives({});

    expect(result.status).toBe("success");
    const data = dataOf(result);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.counts).toEqual({
      departments: 1,
      faculty: 0,
      admins: 0,
      electiveBatches: 1,
      electiveBatchFaculties: 1,
      electiveAssignments: 1,
    });
  });
});
