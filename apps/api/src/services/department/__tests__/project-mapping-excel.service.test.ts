import { beforeEach, describe, expect, it, mock } from "bun:test";
import ExcelJS from "exceljs";

const courseFixture: Record<string, unknown> = {
  id: "c1",
  code: "PW101",
  name: "Final Year Project",
  courseType: "PW",
  courseMode: "FINAL_SUMMARY",
  approvalStatus: "DRAFT",
  departmentId: "dept-cse",
  departmentName: "CSE",
  semesterId: "sem8",
  semesterNumber: 8,
  cycle: "NONE",
  numberOfBatches: 3,
  studentsPerBatch: 5,
  projectGroupingScope: "DEPARTMENT_WIDE",
  electiveMappingVersion: 2,
  semester: { academicTerm: { type: "EVEN", year: "2026" } },
};

const batchesFixture = [
  {
    id: "g1",
    name: "G-001",
    sectionId: null,
    sortOrder: 1,
    facultyAssignment: {
      semester: 8,
      academicYear: "2026",
      faculty: { shortName: "Ravi", user: { name: "Dr. Ravi Kumar" } },
    },
  },
  {
    id: "g2",
    name: "G-002",
    sectionId: null,
    sortOrder: 2,
    facultyAssignment: null,
  },
  {
    id: "g3",
    name: "G-003",
    sectionId: null,
    sortOrder: 3,
    facultyAssignment: null,
  },
];

const assignmentsFixture = [
  {
    electiveBatchId: "g1",
    student: { usn: "1BM22CS001", user: { name: "Keshav" } },
  },
  {
    electiveBatchId: "g2",
    student: { usn: "1BM22CS014", user: { name: "Rahul" } },
  },
];

const registrationsFixture = [
  {
    studentId: "s1",
    student: {
      id: "s1",
      usn: "1BM22CS001",
      departmentName: "CSE",
      semesterId: "sem8",
      studentSections: [
        {
          section: {
            id: "sec-a",
            name: "A",
            cycle: "NONE",
            semesterId: "sem8",
          },
        },
      ],
    },
  },
  {
    studentId: "s2",
    student: {
      id: "s2",
      usn: "1BM22CS014",
      departmentName: "CSE",
      semesterId: "sem8",
      studentSections: [
        {
          section: {
            id: "sec-a",
            name: "A",
            cycle: "NONE",
            semesterId: "sem8",
          },
        },
      ],
    },
  },
];

const facultyRecordsFixture = [
  {
    id: "f1",
    shortName: "Ambuja",
    departmentId: "dept-cse",
    user: { name: "Dr. Ambuja" },
  },
  {
    id: "f2",
    shortName: "Ravi",
    departmentId: "dept-cse",
    user: { name: "Dr. Ravi Kumar" },
  },
];

let electiveStudentAssignmentsFixture: Array<{
  electiveBatchId: string;
  studentId?: string;
  student?: { usn: string; user: { name: string } };
}> = [];
let electiveBatchFacultyFixture: Array<{
  electiveBatchId: string;
  facultyId: string;
}> = [];
let hasAttendanceOrMarks = false;

const dbMock = {
  department: {
    findFirst: async () => ({ id: "dept-cse", name: "CSE" }),
    findUnique: async () => ({ type: "DEGREE_GRANTING" }),
  },
  course: {
    findFirst: async ({ where }: { where: { courseType?: string } }) =>
      where?.courseType === "PW" ? { ...courseFixture } : null,
  },
  electiveBatch: {
    findMany: async () => batchesFixture,
  },
  courseRegistration: {
    findMany: async () => registrationsFixture,
  },
  faculty: {
    findMany: async () => facultyRecordsFixture,
  },
  electiveStudentAssignment: {
    findMany: async () => electiveStudentAssignmentsFixture,
  },
  electiveBatchFaculty: {
    findMany: async () => electiveBatchFacultyFixture,
  },
  attendance: {
    findFirst: async () => (hasAttendanceOrMarks ? { id: "att-1" } : null),
  },
  mark: {
    findFirst: async () => (hasAttendanceOrMarks ? { id: "mk-1" } : null),
  },
  classSession: {
    findFirst: async () => null,
  },
  $transaction: async (fn: (tx: unknown) => unknown) => fn({}),
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(message: string, options?: { code?: string }) {
        super(message);
        this.code = options?.code ?? "";
      }
    },
  },
  CourseApprovalStatus: {
    APPROVED: "APPROVED",
    PENDING: "PENDING",
    DRAFT: "DRAFT",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
  Designation: {},
  Cycle: { PHYSICS: "PHYSICS", CHEMISTRY: "CHEMISTRY", NONE: "NONE" },
  PrismaClient: class PrismaClient {
    constructor() {
      return dbMock;
    }
  },
}));

mock.module("@webcampus/common/logger", () => ({
  logger: { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} },
}));

const { ProjectMappingService } = await import("../project-mapping.service");

async function buildWorkbook(
  dataRows: Array<[string, string, string]>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Project Mapping");
  for (let i = 1; i <= 6; i++) ws.addRow([]);
  ws.addRow(["Group", "Faculty", "USN:Student"]);
  for (const row of dataRows) ws.addRow(row);
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

async function readWorkbook(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(1);
  if (!ws) throw new Error("no worksheet");
  return ws;
}

function registrationsFor(
  usns: string[]
): Array<{ studentId: string; student: Record<string, unknown> }> {
  return usns.map((usn, i) => ({
    studentId: `s${i + 1}`,
    student: {
      id: `s${i + 1}`,
      usn,
      departmentName: "CSE",
      semesterId: "sem8",
      studentSections: [
        {
          section: {
            id: "sec-a",
            name: "A",
            cycle: "NONE",
            semesterId: "sem8",
          },
        },
      ],
    },
  }));
}

async function extractError(result: Promise<unknown>): Promise<{
  errors: Array<{ code: string; value?: string; message?: string }>;
}> {
  const error = await result.then(
    () => null,
    (e: unknown) => e
  );
  return error as {
    errors: Array<{ code: string; value?: string; message?: string }>;
  };
}

describe("ProjectMappingService.generateTemplate", () => {
  beforeEach(() => {
    electiveStudentAssignmentsFixture = [...assignmentsFixture];
  });

  it("writes the 3-column header on row 7", async () => {
    const buffer = await ProjectMappingService.generateTemplate("c1", "user-1");
    const ws = await readWorkbook(buffer);
    expect(ws.getCell(7, 1).text).toBe("Group");
    expect(ws.getCell(7, 2).text).toBe("Faculty");
    expect(ws.getCell(7, 3).text).toBe("USN:Student");
  });

  it("lists every group exactly once, with empty groups as faculty-only rows", async () => {
    const buffer = await ProjectMappingService.generateTemplate("c1", "user-1");
    const ws = await readWorkbook(buffer);
    const groups: string[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 7) return;
      const group = String(row.getCell(1).text).trim();
      if (group) groups.push(group);
    });
    expect(groups).toEqual(["G-001", "G-002", "G-003"]);
  });

  it("formats the student cell as USN:Student and pre-fills the faculty", async () => {
    const buffer = await ProjectMappingService.generateTemplate("c1", "user-1");
    const ws = await readWorkbook(buffer);
    let studentCell = "";
    let facultyCell = "";
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 7) return;
      if (String(row.getCell(1).text).trim() === "G-001") {
        studentCell = String(row.getCell(3).text).trim();
        facultyCell = String(row.getCell(2).text).trim();
      }
    });
    expect(studentCell).toBe("1BM22CS001:Keshav");
    expect(facultyCell).toBe("Dr. Ravi Kumar");
  });

  it("leaves the faculty cell empty for the empty group (G-003)", async () => {
    const buffer = await ProjectMappingService.generateTemplate("c1", "user-1");
    const ws = await readWorkbook(buffer);
    let usnCell = "unset";
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 7) return;
      if (String(row.getCell(1).text).trim() === "G-003") {
        usnCell = String(row.getCell(3).text).trim();
      }
    });
    expect(usnCell).toBe("");
  });
});

describe("ProjectMappingService.validateUpload", () => {
  beforeEach(() => {
    electiveStudentAssignmentsFixture = [];
    electiveBatchFacultyFixture = [];
    hasAttendanceOrMarks = false;
    courseFixture.projectGroupingScope = "DEPARTMENT_WIDE";
    courseFixture.studentsPerBatch = 5;
    (batchesFixture[1] as { sectionId: string | null }).sectionId = null;
    dbMock.faculty.findMany = (async () =>
      facultyRecordsFixture) as typeof dbMock.faculty.findMany;
  });

  it("accepts a complete valid file and returns staged student + faculty assignments", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
      ["G-002", "Dr. Ambuja", "1BM22CS014:Rahul"],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      assignments: { studentId: string; electiveBatchId: string }[];
      facultyAssignments: {
        electiveBatchId: string;
        facultyId: string | null;
      }[];
    };
    expect(data.assignments).toEqual([
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g2" },
    ]);
    expect(data.facultyAssignments).toEqual([
      { electiveBatchId: "g1", facultyId: "f2" },
      { electiveBatchId: "g2", facultyId: "f1" },
      { electiveBatchId: "g3", facultyId: "f1" },
    ]);
  });

  it("rejects an unknown USN with UNKNOWN_USN", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS999:Keshav"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const err = error as { errors: Array<{ code: string }> };
    expect(err.errors[0]!.code).toBe("UNKNOWN_USN");
  });

  it("rejects an unknown group with UNKNOWN_GROUP", async () => {
    const buffer = await buildWorkbook([
      ["G-999", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    expect((error as { errors: Array<{ code: string }> }).errors[0]!.code).toBe(
      "UNKNOWN_GROUP"
    );
  });

  it("rejects a group appearing twice with DUPLICATE_GROUP", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
      ["G-001", "Dr. Ambuja", "1BM22CS014:Rahul"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("DUPLICATE_GROUP");
  });

  it("rejects a student appearing twice with DUPLICATE_STUDENT", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
      ["G-002", "Dr. Ambuja", "1BM22CS001:Keshav"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("DUPLICATE_STUDENT");
  });

  it("rejects an unknown faculty with UNKNOWN_FACULTY", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Nobody", "1BM22CS001:Keshav"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    expect((error as { errors: Array<{ code: string }> }).errors[0]!.code).toBe(
      "UNKNOWN_FACULTY"
    );
  });

  it("rejects an ambiguous faculty match with AMBIGUOUS_FACULTY", async () => {
    const ambiguous = [
      {
        id: "f1",
        shortName: "Ambuja",
        departmentId: "dept-cse",
        user: { name: "Dr. Same Name" },
      },
      {
        id: "f2",
        shortName: "Ravi",
        departmentId: "dept-cse",
        user: { name: "Dr. Same Name" },
      },
    ];
    dbMock.faculty.findMany = (async () =>
      ambiguous) as unknown as typeof dbMock.faculty.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Same Name", "1BM22CS001:Keshav"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("AMBIGUOUS_FACULTY");
  });

  it("resolves a faculty from another department", async () => {
    const crossDept = [
      {
        id: "f1",
        shortName: "Ambuja",
        departmentId: "dept-other",
        user: { name: "Dr. Ambuja" },
      },
      {
        id: "f2",
        shortName: "Ravi",
        departmentId: "dept-cse",
        user: { name: "Dr. Ravi Kumar" },
      },
    ];
    dbMock.faculty.findMany = (async () =>
      crossDept) as unknown as typeof dbMock.faculty.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ambuja", "1BM22CS001:Keshav"],
      ["G-002", "Dr. Ravi Kumar", "1BM22CS014:Rahul"],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      facultyAssignments: {
        electiveBatchId: string;
        facultyId: string | null;
      }[];
    };
    expect(data.facultyAssignments[0]).toEqual({
      electiveBatchId: "g1",
      facultyId: "f1",
    });
  });

  it("rejects a student placed outside their section with WRONG_SECTION", async () => {
    courseFixture.projectGroupingScope = "WITHIN_SECTION";
    (batchesFixture[1] as { sectionId: string | null }).sectionId = "sec-b";
    const buffer = await buildWorkbook([
      ["G-002", "Dr. Ambuja", "1BM22CS001:Keshav"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("WRONG_SECTION");
  });

  it("rejects a group over capacity with OVER_CAPACITY", async () => {
    courseFixture.studentsPerBatch = 1;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
      ["G-001", "Dr. Ravi Kumar", "1BM22CS014:Rahul"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("OVER_CAPACITY");
  });

  it("rejects a file that omits a group with MISSING_GROUP", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
      ["G-002", "Dr. Ambuja", "1BM22CS014:Rahul"],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("MISSING_GROUP");
  });

  it("rejects a group with no faculty with MISSING_FACULTY", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
      ["G-002", "Dr. Ambuja", "1BM22CS014:Rahul"],
      ["G-003", "", ""],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("MISSING_FACULTY");
  });

  it("rejects a file that omits a registered student with MISSING_STUDENT", async () => {
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav"],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("MISSING_STUDENT");
  });

  it("rejects a file exceeding the 10,000 row safety limit with EXCEEDS_ROW_LIMIT", async () => {
    const rows: Array<[string, string, string]> = [];
    for (let i = 0; i < 10001; i++) {
      rows.push([
        `G-${String((i % 3) + 1).padStart(3, "0")}`,
        "Dr. Ravi Kumar",
        "",
      ]);
    }
    const buffer = await buildWorkbook(rows);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const err = error as { errors: Array<{ code: string }> };
    expect(err.errors.length).toBe(1);
    expect(err.errors[0]!.code).toBe("EXCEEDS_ROW_LIMIT");
  });

  it("rejects student reassignment after attendance/marks with LOCKED_AFTER_ATTENDANCE", async () => {
    hasAttendanceOrMarks = true;
    electiveStudentAssignmentsFixture = [
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g2" },
    ];
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", ""],
      ["G-002", "Dr. Ambuja", "1BM22CS001:Keshav"],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("LOCKED_AFTER_ATTENDANCE");
  });

  it("rejects faculty reassignment after attendance/marks with LOCKED_AFTER_ATTENDANCE", async () => {
    hasAttendanceOrMarks = true;
    electiveBatchFacultyFixture = [{ electiveBatchId: "g1", facultyId: "f2" }];
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ambuja", "1BM22CS001:Keshav"],
      ["G-002", "Dr. Ambuja", "1BM22CS014:Rahul"],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const error = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    ).then(
      () => null,
      (e: unknown) => e
    );
    const codes = (error as { errors: Array<{ code: string }> }).errors.map(
      (e) => e.code
    );
    expect(codes).toContain("LOCKED_AFTER_ATTENDANCE");
  });

  it("parses multiple students from a single group cell into separate assignments", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      [
        "G-001",
        "Dr. Ravi Kumar",
        "1BM22CS001:Keshav, 1BM22CS002:Rahul, 1BM22CS003:Ananya",
      ],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      assignments: { studentId: string; electiveBatchId: string }[];
    };
    expect(data.assignments).toEqual([
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g1" },
      { studentId: "s3", electiveBatchId: "g1" },
    ]);
  });

  it("parses multiple groups each with multiple students (5 assignments total)", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
        "1BM22CS004",
        "1BM22CS005",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001, 1BM22CS002, 1BM22CS003"],
      ["G-002", "Dr. Ambuja", "1BM22CS004, 1BM22CS005"],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      assignments: { studentId: string; electiveBatchId: string }[];
    };
    expect(data.assignments).toEqual([
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g1" },
      { studentId: "s3", electiveBatchId: "g1" },
      { studentId: "s4", electiveBatchId: "g2" },
      { studentId: "s5", electiveBatchId: "g2" },
    ]);
  });

  it("parses bare USN-only entries (no colon) into separate students", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001, 1BM22CS002, 1BM22CS003"],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      assignments: { studentId: string; electiveBatchId: string }[];
    };
    expect(data.assignments).toHaveLength(3);
  });

  it("trims whitespace around comma-separated entries", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      [
        "G-001",
        "Dr. Ravi Kumar",
        " 1BM22CS001:Keshav , 1BM22CS002:Rahul  ,  1BM22CS003:Ananya",
      ],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      assignments: { studentId: string; electiveBatchId: string }[];
    };
    expect(data.assignments).toHaveLength(3);
  });

  it("ignores an empty entry left by a trailing comma (no phantom student)", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001:Keshav, 1BM22CS002:Rahul,"],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      assignments: { studentId: string; electiveBatchId: string }[];
    };
    expect(data.assignments).toEqual([
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g1" },
    ]);
  });

  it("detects a student duplicated across two groups with DUPLICATE_STUDENT", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001, 1BM22CS002"],
      ["G-002", "Dr. Ambuja", "1BM22CS002, 1BM22CS003"],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const err = await extractError(
      ProjectMappingService.validateUpload("c1", buffer, "user-1")
    );
    const codes = err.errors.map((e) => e.code);
    expect(codes).toContain("DUPLICATE_STUDENT");
    const dup = err.errors.find((e) => e.code === "DUPLICATE_STUDENT");
    expect(dup?.value).toBe("1BM22CS002");
  });

  it("reports only the invalid entry when a cell mixes valid and invalid USNs", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001, 1BM22CS999"],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const err = await extractError(
      ProjectMappingService.validateUpload("c1", buffer, "user-1")
    );
    const unknown = err.errors.filter((e) => e.code === "UNKNOWN_USN");
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.value).toBe("1BM22CS999");
    expect(unknown[0]?.message).toContain("1BM22CS999");
  });

  it("flags only the unassigned registered student as MISSING_STUDENT", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001, 1BM22CS002"],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const err = await extractError(
      ProjectMappingService.validateUpload("c1", buffer, "user-1")
    );
    const missing = err.errors.filter((e) => e.code === "MISSING_STUDENT");
    expect(missing).toHaveLength(1);
    expect(missing[0]?.value).toBe("1BM22CS003");
  });

  it("accepts a zero-student group next to a multi-student group", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001, 1BM22CS002"],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
  });

  it("rejects a group over capacity when multiple students are in one cell", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
      ])) as typeof dbMock.courseRegistration.findMany;
    courseFixture.studentsPerBatch = 2;
    const buffer = await buildWorkbook([
      ["G-001", "Dr. Ravi Kumar", "1BM22CS001, 1BM22CS002, 1BM22CS003"],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const err = await extractError(
      ProjectMappingService.validateUpload("c1", buffer, "user-1")
    );
    const codes = err.errors.map((e) => e.code);
    expect(codes).toContain("OVER_CAPACITY");
  });

  it("keeps the staged faculty assignments complete when students are parsed from one cell", async () => {
    dbMock.courseRegistration.findMany = (async () =>
      registrationsFor([
        "1BM22CS001",
        "1BM22CS002",
        "1BM22CS003",
      ])) as typeof dbMock.courseRegistration.findMany;
    const buffer = await buildWorkbook([
      [
        "G-001",
        "Dr. Ravi Kumar",
        "1BM22CS001:Keshav, 1BM22CS002:Rahul, 1BM22CS003:Ananya",
      ],
      ["G-002", "Dr. Ambuja", ""],
      ["G-003", "Dr. Ambuja", ""],
    ]);
    const result = await ProjectMappingService.validateUpload(
      "c1",
      buffer,
      "user-1"
    );
    expect(result.status).toBe("success");
    const data = (result as { data: unknown }).data as {
      assignments: { studentId: string; electiveBatchId: string }[];
      facultyAssignments: { electiveBatchId: string; facultyId: string }[];
    };
    expect(data.assignments).toHaveLength(3);
    expect(data.facultyAssignments).toEqual([
      { electiveBatchId: "g1", facultyId: "f2" },
      { electiveBatchId: "g2", facultyId: "f1" },
      { electiveBatchId: "g3", facultyId: "f1" },
    ]);
  });
});
