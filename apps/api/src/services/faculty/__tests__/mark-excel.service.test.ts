/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";
import ExcelJS from "exceljs";

type SaRecord = {
  id: string;
  studentId: string;
  assessmentId: string;
  courseId: string;
  totalMarks: number;
  status: string;
};

type QmRecord = {
  id: string;
  recordId: string;
  questionId: string;
  marksObtained: number;
};

type MarkRecord = {
  studentId: string;
  courseId: string;
  cieTotal: number;
  status: string;
};

const COURSE_CONFIG = {
  id: "course-1",
  code: "CS101",
  cieMaxMarks: 100,
  cieEligibility: 40,
  cieEligibilityPolicy: "OVERALL_ONLY",
  theoryMaxExams: 3,
  theoryMinExams: 1,
  theoryExamMaxMarks: 100,
  theoryCieContribution: 100,
  theoryEligibility: 40,
  labMaxMarks: 0,
  labEligibility: 40,
  aatMaxMarks: 0,
  aatEligibility: 40,
};

const ASSESSMENT = {
  id: "assessment-1",
  courseId: "course-1",
  semesterId: "semester-1",
  title: "Theory Exam 1",
  totalMarks: 50,
  questions: [
    { id: "q1", part: "A", qNumber: "1", marks: 25, orGroupId: null },
    { id: "q2", part: "B", qNumber: "2", marks: 25, orGroupId: null },
  ],
  course: {
    id: "course-1",
    code: "CS101",
    name: "Data Structures",
    approvalStatus: "APPROVED",
    semester: {
      id: "semester-1",
      semesterNumber: 3,
      academicTerm: { type: "ODD", year: 2026 },
    },
  },
};

const REGISTRATIONS = ["A", "B", "C", "D"].map((s) => ({
  student: {
    id: `stu-${s}`,
    usn: `USN${s}`,
    user: { name: `Student ${s}`, email: `s${s}@webcampus.com` },
  },
}));

let saRecords: SaRecord[] = [];
let qmRecords: QmRecord[] = [];
let markRecords: MarkRecord[] = [];
let deleteManyCount = 0;
let deleteManyThrows = false;
let idCounter = 1;

const dbMock = {
  $transaction: async <T>(cb: (tx: unknown) => T) => cb(dbMock) as T,
  faculty: {
    findUnique: async () => ({ id: "faculty-1" }),
  },
  assessmentTemplate: {
    findUnique: async () => ASSESSMENT,
    findMany: async () => [],
  },
  courseAssignment: {
    findFirst: async () => ({
      id: "ca-1",
      freezes: { facultyFrozen: false, hodFrozen: false, adminFrozen: false },
    }),
  },
  courseRegistration: {
    findMany: async () => REGISTRATIONS,
    findFirst: async () => ({ id: "reg-1" }),
  },
  course: {
    findUnique: async () => COURSE_CONFIG,
  },
  studentAssessment: {
    upsert: async (args: {
      where: {
        studentId_assessmentId: { studentId: string; assessmentId: string };
      };
      create: {
        studentId: string;
        assessmentId: string;
        courseId: string;
        totalMarks: number;
        status: string;
      };
      update: { totalMarks: number; status: string };
    }) => {
      const { studentId, assessmentId } = args.where.studentId_assessmentId;
      const existing = saRecords.find(
        (r) => r.studentId === studentId && r.assessmentId === assessmentId
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const record: SaRecord = {
        id: `sa-${idCounter++}`,
        studentId,
        assessmentId,
        courseId: args.create.courseId,
        totalMarks: args.create.totalMarks,
        status: args.create.status,
      };
      saRecords.push(record);
      return record;
    },
    findMany: async (args?: {
      where?: {
        assessmentId?: string;
        studentId?: { in?: string[] };
        courseId?: string;
      };
      select?: Record<string, unknown>;
    }) => {
      let records = saRecords;
      if (args?.where?.assessmentId) {
        records = records.filter(
          (r) => r.assessmentId === args?.where?.assessmentId
        );
      }
      if (args?.where?.studentId?.in) {
        const ids = new Set(args.where.studentId.in);
        records = records.filter((r) => ids.has(r.studentId));
      }
      if (args?.where?.courseId) {
        records = records.filter((r) => r.courseId === args?.where?.courseId);
      }
      if (args?.select) {
        return records.map((r) => {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(args.select ?? {})) {
            if (key in r) out[key] = (r as Record<string, unknown>)[key];
          }
          return out;
        });
      }
      return records;
    },
  },
  studentQuestionMark: {
    upsert: async (args: {
      where: { recordId_questionId: { recordId: string; questionId: string } };
      create: {
        recordId: string;
        questionId: string;
        marksObtained: number;
      };
      update: { marksObtained: number };
    }) => {
      const { recordId, questionId } = args.where.recordId_questionId;
      const existing = qmRecords.find(
        (r) => r.recordId === recordId && r.questionId === questionId
      );
      if (existing) {
        existing.marksObtained = args.update.marksObtained;
        return existing;
      }
      const record: QmRecord = {
        id: `qm-${idCounter++}`,
        recordId,
        questionId,
        marksObtained: args.create.marksObtained,
      };
      qmRecords.push(record);
      return record;
    },
    deleteMany: async (args?: { where?: { recordId?: { in?: string[] } } }) => {
      deleteManyCount++;
      if (deleteManyThrows) {
        throw new Error("simulated delete failure");
      }
      const recordIds = new Set(args?.where?.recordId?.in ?? []);
      const before = qmRecords.length;
      qmRecords = qmRecords.filter((r) => !recordIds.has(r.recordId));
      return { count: before - qmRecords.length };
    },
  },
  mark: {
    upsert: async (args: {
      where: { studentId_courseId: { studentId: string; courseId: string } };
      create: {
        studentId: string;
        courseId: string;
        cieTotal: number;
        status: string;
      };
      update: { cieTotal: number; status: string };
    }) => {
      const { studentId, courseId } = args.where.studentId_courseId;
      const existing = markRecords.find(
        (r) => r.studentId === studentId && r.courseId === courseId
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const record: MarkRecord = {
        ...args.create,
      };
      markRecords.push(record);
      return record;
    },
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  CourseApprovalStatus: {
    APPROVED: "APPROVED",
    PENDING: "PENDING",
    DRAFT: "DRAFT",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
    warn: () => {},
  },
}));

async function buildWorkbookBuffer(
  header: Array<string>,
  rows: Array<Array<string | number | null | undefined>>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Marks Entry");
  worksheet.addRow(header);
  rows.forEach((data) => worksheet.addRow(data));
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function findByStudent(
  records: SaRecord[],
  studentId: string
): SaRecord | undefined {
  return records.find((r) => r.studentId === studentId);
}

const STANDARD_HEADER = [
  "USN",
  "Student Name",
  "Student Email",
  "Status",
  "1",
  "2",
];

describe("resolveExcelStatus", () => {
  it("normalizes accepted values to PRESENT / ABSENT / MP", async () => {
    const { resolveExcelStatus } = await import("../mark.service");
    expect(resolveExcelStatus("Present").status).toBe("PRESENT");
    expect(resolveExcelStatus("PRESENT").status).toBe("PRESENT");
    expect(resolveExcelStatus("  Present ").status).toBe("PRESENT");
    expect(resolveExcelStatus("Absent").status).toBe("ABSENT");
    expect(resolveExcelStatus(" Absent ").status).toBe("ABSENT");
    expect(resolveExcelStatus("MP").status).toBe("MP");
    expect(resolveExcelStatus("mp").status).toBe("MP");
    expect(resolveExcelStatus("Mp").status).toBe("MP");
    expect(resolveExcelStatus("").status).toBe("PRESENT");
    expect(resolveExcelStatus(undefined).status).toBe("PRESENT");
  });

  it("rejects invalid values with a descriptive error", async () => {
    const { resolveExcelStatus } = await import("../mark.service");
    const result = resolveExcelStatus("N/A");
    expect(result.status).toBeNull();
    expect(result.error).toContain("Allowed values");
    expect(result.error).toContain("Present");
    expect(result.error).toContain("Absent");
    expect(result.error).toContain("MP");
  });
});

describe("generateMarksTemplate", () => {
  beforeEach(resetState);

  it("adds a Status column after Student Email and removes the Total column", async () => {
    const { Mark } = await import("../mark.service");
    const buffer = await Mark.generateMarksTemplate("user-1", "assessment-1");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.getWorksheet("Marks Entry");
    expect(worksheet).toBeDefined();

    const headerRow = worksheet!.getRow(8);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      headers.push(String(cell.text ?? "").trim());
    });
    expect(headers).toContain("Status");
    expect(headers.indexOf("Status")).toBe(
      headers.indexOf("Student Email") + 1
    );
    expect(headers).not.toContain("Total");

    const rosterRow = worksheet!.getRow(9);
    expect(String(rosterRow.getCell(4).text).trim()).toBe("Present");
    const validation = rosterRow.getCell(4).dataValidation as
      | { type?: string; formulae?: string[] }
      | undefined;
    expect(validation?.type).toBe("list");
    expect(validation?.formulae?.[0]).toContain("Present");
    expect(validation?.formulae?.[0]).toContain("Absent");
    expect(validation?.formulae?.[0]).toContain("MP");
  });
});

describe("uploadMarksFromExcel", () => {
  beforeEach(resetState);

  it("imports a mixed-status spreadsheet: Present marks, Absent/MP blank", async () => {
    const { Mark } = await import("../mark.service");
    const buffer = await buildWorkbookBuffer(STANDARD_HEADER, [
      ["USNA", "Student A", "a@x.com", "Present", "20", "25"],
      ["USNB", "Student B", "b@x.com", "Absent", "", ""],
      ["USNC", "Student C", "c@x.com", "MP", "", ""],
      ["USND", "Student D", "d@x.com", "Present", "0", "0"],
    ]);

    const result = await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      buffer
    );
    expect(result.status).toBe("success");

    expect(saRecords).toHaveLength(4);
    const a = findByStudent(saRecords, "stu-A")!;
    const b = findByStudent(saRecords, "stu-B")!;
    const c = findByStudent(saRecords, "stu-C")!;
    const d = findByStudent(saRecords, "stu-D")!;
    expect([a.status, a.totalMarks]).toEqual(["PRESENT", 45]);
    expect([b.status, b.totalMarks]).toEqual(["ABSENT", 0]);
    expect([c.status, c.totalMarks]).toEqual(["MP", 0]);
    expect([d.status, d.totalMarks]).toEqual(["PRESENT", 0]);

    const aRecord = a.id;
    const dRecord = d.id;
    const aQm = qmRecords.filter(
      (r) => r.recordId === aRecord && r.marksObtained > 0
    );
    expect(aQm.length).toBe(2);
    expect(aQm.map((r) => r.marksObtained).sort()).toEqual([20, 25]);
    const dQm = qmRecords.filter((r) => r.recordId === dRecord);
    expect(dQm.length).toBe(2);
    expect(dQm.every((r) => r.marksObtained === 0)).toBe(true);
  }, 10000);

  it("rejects an invalid status value with a row-level error", async () => {
    const { Mark, MarksExcelValidationError } = await import("../mark.service");
    const buffer = await buildWorkbookBuffer(STANDARD_HEADER, [
      ["USNA", "Student A", "a@x.com", "N/A", "20", "25"],
    ]);

    let thrown: unknown;
    try {
      await Mark.uploadMarksFromExcel(
        "user-1",
        "assessment-1",
        undefined,
        buffer
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MarksExcelValidationError);
    const err = (thrown as InstanceType<typeof MarksExcelValidationError>)
      .errors[0]!;
    expect(err.row).toBe(2);
    expect(err.question).toBe("Status");
    expect(err.message).toContain("Row 2");
    expect(err.message).toContain("Allowed values");
    expect(saRecords).toHaveLength(0);
    expect(qmRecords).toHaveLength(0);
  }, 10000);

  it("rejects a template with duplicate Status columns", async () => {
    const { Mark, MarksExcelValidationError } = await import("../mark.service");
    const buffer = await buildWorkbookBuffer(
      ["USN", "Student Name", "Student Email", "Status", "status", "1", "2"],
      [["USNA", "Student A", "a@x.com", "Present", "Absent", "20", "25"]]
    );

    let thrown: unknown;
    try {
      await Mark.uploadMarksFromExcel(
        "user-1",
        "assessment-1",
        undefined,
        buffer
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MarksExcelValidationError);
    const message = (thrown as InstanceType<typeof MarksExcelValidationError>)
      .errors[0]!.message;
    expect(message).toContain("Keep exactly one");
    expect(saRecords).toHaveLength(0);
  }, 10000);

  it("imports a legacy template without a Status column as all Present", async () => {
    const { Mark } = await import("../mark.service");
    const buffer = await buildWorkbookBuffer(
      ["USN", "Student Name", "Student Email", "1", "2"],
      [
        ["USNA", "Student A", "a@x.com", "20", "25"],
        ["USNB", "Student B", "b@x.com", "", ""],
      ]
    );

    const result = await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      buffer
    );
    expect(result.status).toBe("success");
    expect(saRecords).toHaveLength(2);
    const a = findByStudent(saRecords, "stu-A")!;
    const b = findByStudent(saRecords, "stu-B")!;
    expect([a.status, a.totalMarks]).toEqual(["PRESENT", 45]);
    expect([b.status, b.totalMarks]).toEqual(["PRESENT", 0]);
  }, 10000);

  it("handles Present -> Absent -> Present transitions with no stale marks", async () => {
    const { Mark } = await import("../mark.service");

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Present", "20", "25"],
      ])
    );
    expect(findByStudent(saRecords, "stu-A")).toMatchObject({
      status: "PRESENT",
      totalMarks: 45,
    });

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Absent", "", ""],
      ])
    );
    const absent = findByStudent(saRecords, "stu-A")!;
    expect([absent.status, absent.totalMarks]).toEqual(["ABSENT", 0]);
    expect(deleteManyCount).toBeGreaterThan(0);
    expect(qmRecords.filter((r) => r.recordId === absent.id)).toHaveLength(0);

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Present", "10", "15"],
      ])
    );
    const present = findByStudent(saRecords, "stu-A")!;
    expect([present.status, present.totalMarks]).toEqual(["PRESENT", 25]);
    const aQm = qmRecords
      .filter((r) => r.recordId === present.id)
      .map((r) => r.marksObtained)
      .sort();
    expect(aQm).toEqual([10, 15]);
  }, 20000);

  it("handles Present -> MP -> Present transitions with no stale marks", async () => {
    const { Mark } = await import("../mark.service");

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Present", "20", "25"],
      ])
    );

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "MP", "", ""],
      ])
    );
    const mp = findByStudent(saRecords, "stu-A")!;
    expect([mp.status, mp.totalMarks]).toEqual(["MP", 0]);
    expect(deleteManyCount).toBeGreaterThan(0);

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Present", "8", "9"],
      ])
    );
    const present = findByStudent(saRecords, "stu-A")!;
    expect([present.status, present.totalMarks]).toEqual(["PRESENT", 17]);
  }, 20000);

  it("wipes stale question marks when a marked student becomes Absent", async () => {
    const { Mark } = await import("../mark.service");

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Present", "20", "25"],
      ])
    );
    expect(qmRecords).toHaveLength(2);

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Absent", "", ""],
      ])
    );
    expect(deleteManyCount).toBeGreaterThan(0);
    expect(qmRecords).toHaveLength(0);
    expect(findByStudent(saRecords, "stu-A")).toMatchObject({
      status: "ABSENT",
      totalMarks: 0,
    });
  }, 20000);

  it("keeps state correct across a full mixed-status re-import", async () => {
    const { Mark } = await import("../mark.service");

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Present", "20", "25"],
        ["USNB", "Student B", "b@x.com", "Absent", "", ""],
        ["USNC", "Student C", "c@x.com", "MP", "", ""],
        ["USND", "Student D", "d@x.com", "Present", "0", "0"],
      ])
    );

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "MP", "", ""],
        ["USNB", "Student B", "b@x.com", "Present", "10", "15"],
        ["USNC", "Student C", "c@x.com", "Absent", "", ""],
        ["USND", "Student D", "d@x.com", "Present", "5", "5"],
      ])
    );

    const a = findByStudent(saRecords, "stu-A")!;
    const b = findByStudent(saRecords, "stu-B")!;
    const c = findByStudent(saRecords, "stu-C")!;
    const d = findByStudent(saRecords, "stu-D")!;
    expect([a.status, a.totalMarks]).toEqual(["MP", 0]);
    expect([b.status, b.totalMarks]).toEqual(["PRESENT", 25]);
    expect([c.status, c.totalMarks]).toEqual(["ABSENT", 0]);
    expect([d.status, d.totalMarks]).toEqual(["PRESENT", 10]);

    expect(qmRecords).toHaveLength(4);
    const bQm = qmRecords
      .filter((r) => r.recordId === b.id)
      .map((r) => r.marksObtained)
      .sort();
    const dQm = qmRecords
      .filter((r) => r.recordId === d.id)
      .map((r) => r.marksObtained)
      .sort();
    expect(bQm).toEqual([10, 15]);
    expect(dQm).toEqual([5, 5]);

    expect(markRecords).toHaveLength(4);
    expect(markRecords.find((m) => m.studentId === "stu-A")?.cieTotal).toBe(0);
  }, 20000);

  it("rolls back the whole import when the stale-deletion step fails", async () => {
    const { Mark } = await import("../mark.service");

    await Mark.uploadMarksFromExcel(
      "user-1",
      "assessment-1",
      undefined,
      await buildWorkbookBuffer(STANDARD_HEADER, [
        ["USNA", "Student A", "a@x.com", "Present", "20", "25"],
        ["USNB", "Student B", "b@x.com", "Present", "10", "15"],
      ])
    );
    const beforeSa = JSON.stringify(saRecords);
    const beforeQm = JSON.stringify(qmRecords);
    const beforeMark = JSON.stringify(markRecords);

    deleteManyThrows = true;
    let thrown: unknown;
    try {
      await Mark.uploadMarksFromExcel(
        "user-1",
        "assessment-1",
        undefined,
        await buildWorkbookBuffer(STANDARD_HEADER, [
          ["USNA", "Student A", "a@x.com", "Present", "20", "25"],
          ["USNB", "Student B", "b@x.com", "Absent", "", ""],
        ])
      );
    } catch (error) {
      thrown = error;
    }
    deleteManyThrows = false;

    expect(thrown).toBeDefined();
    expect((thrown as Error).message).toContain("simulated delete failure");
    expect(JSON.stringify(saRecords)).toBe(beforeSa);
    expect(JSON.stringify(qmRecords)).toBe(beforeQm);
    expect(JSON.stringify(markRecords)).toBe(beforeMark);
    expect(findByStudent(saRecords, "stu-B")).toMatchObject({
      status: "PRESENT",
      totalMarks: 25,
    });
  }, 20000);
});

function resetState(): void {
  saRecords = [];
  qmRecords = [];
  markRecords = [];
  deleteManyCount = 0;
  deleteManyThrows = false;
  idCounter = 1;
}
