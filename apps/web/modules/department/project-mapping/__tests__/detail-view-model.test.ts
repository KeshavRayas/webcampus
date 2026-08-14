import { describe, expect, test } from "bun:test";
import {
  buildExcelPreviewModel,
  buildFacultyGroupRows,
  buildGroupDetailModel,
  buildSavePayload,
  deriveStudentFaculty,
  PW_DETAIL_TABS,
  type ExcelPreviewInput,
} from "../detail-view-model";

const FACULTY_OPTIONS = [
  { id: "f-1", name: "Ambuja" },
  { id: "f-2", name: "Priya" },
];

const makeGroup = (
  overrides: Partial<Parameters<typeof buildFacultyGroupRows>[0][number]> = {}
) => ({
  id: "eb-1",
  name: "G-001",
  sectionName: "PA",
  studentCount: 10,
  studentsPerGroup: 10,
  facultyId: null,
  facultyName: null,
  status: "UNASSIGNED" as const,
  ...overrides,
});

describe("PW_DETAIL_TABS", () => {
  test("renders exactly two tabs (Students and Faculty & Groups)", () => {
    expect(PW_DETAIL_TABS).toHaveLength(2);
    expect(PW_DETAIL_TABS.map((t) => t.label)).toEqual([
      "Students",
      "Faculty & Groups",
    ]);
    expect(PW_DETAIL_TABS.map((t) => t.value)).toEqual([
      "students",
      "faculty-groups",
    ]);
  });

  test("does not contain a separate Faculty tab", () => {
    const values = PW_DETAIL_TABS.map((t) => t.value);
    expect(values).not.toContain("faculty");
    expect(values).not.toContain("groups");
  });
});

describe("deriveStudentFaculty", () => {
  const student = { studentId: "s-1" };

  test("derives faculty via Student -> Group -> Faculty", () => {
    const localAssignments = { "s-1": "eb-1" };
    const localFaculty = { "eb-1": "f-1" };
    expect(
      deriveStudentFaculty(
        student,
        localAssignments,
        localFaculty,
        FACULTY_OPTIONS
      )
    ).toBe("Ambuja");
  });

  test("returns null when the student has no group", () => {
    expect(
      deriveStudentFaculty(student, {}, { "eb-1": "f-1" }, FACULTY_OPTIONS)
    ).toBeNull();
  });

  test("returns null when the group has no faculty", () => {
    expect(
      deriveStudentFaculty(
        student,
        { "s-1": "eb-1" },
        { "eb-1": null },
        FACULTY_OPTIONS
      )
    ).toBeNull();
  });

  test("does not introduce independent student-level faculty state", () => {
    const localAssignments = { "s-1": "eb-1" };
    const localFaculty = { "eb-1": "f-2" };
    expect(
      deriveStudentFaculty(
        student,
        localAssignments,
        localFaculty,
        FACULTY_OPTIONS
      )
    ).toBe("Priya");
  });
});

describe("buildFacultyGroupRows", () => {
  test("creates one row per group", () => {
    const rows = buildFacultyGroupRows(
      [
        makeGroup({ id: "eb-1", name: "G-001", sectionName: "PA" }),
        makeGroup({ id: "eb-2", name: "G-002", sectionName: "PA" }),
      ],
      {},
      FACULTY_OPTIONS
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toEqual(["G-001", "G-002"]);
  });

  test("zero-student groups still appear", () => {
    const rows = buildFacultyGroupRows(
      [makeGroup({ id: "eb-3", name: "G-003", studentCount: 0 })],
      {},
      FACULTY_OPTIONS
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.studentsLabel).toBe("0 / 10");
  });

  test("uses the local draft faculty when present", () => {
    const rows = buildFacultyGroupRows(
      [makeGroup({ id: "eb-1", facultyId: "f-2", facultyName: "Priya" })],
      { "eb-1": "f-1" },
      FACULTY_OPTIONS
    );
    expect(rows[0]!.facultyId).toBe("f-1");
    expect(rows[0]!.facultyName).toBe("Ambuja");
  });

  test("falls back to the persisted faculty", () => {
    const rows = buildFacultyGroupRows(
      [makeGroup({ id: "eb-1", facultyId: "f-2", facultyName: "Priya" })],
      {},
      FACULTY_OPTIONS
    );
    expect(rows[0]!.facultyId).toBe("f-2");
    expect(rows[0]!.facultyName).toBe("Priya");
  });

  test("preserves group, section and status for each row", () => {
    const rows = buildFacultyGroupRows(
      [
        makeGroup({
          id: "eb-1",
          name: "G-001",
          sectionName: "PA",
          studentCount: 10,
          status: "ASSIGNED",
        }),
      ],
      { "eb-1": "f-1" },
      FACULTY_OPTIONS
    );
    expect(rows[0]).toMatchObject({
      id: "eb-1",
      name: "G-001",
      sectionName: "PA",
      studentsLabel: "10 / 10",
      status: "ASSIGNED",
      facultyName: "Ambuja",
    });
  });

  test("handles 100+ groups without dropping rows", () => {
    const groups = Array.from({ length: 100 }, (_, i) =>
      makeGroup({
        id: `eb-${i + 1}`,
        name: `G-${String(i + 1).padStart(3, "0")}`,
        sectionName: `S${(i % 10) + 1}`,
      })
    );
    const rows = buildFacultyGroupRows(groups, {}, FACULTY_OPTIONS);
    expect(rows).toHaveLength(100);
    expect(rows[99]!.name).toBe("G-100");
  });
});

describe("buildGroupDetailModel", () => {
  const detail = {
    group: {
      id: "eb-1",
      name: "G-001",
      sectionName: "PB",
      studentsPerGroup: 10,
      facultyId: null,
      facultyName: null,
    },
    members: [
      {
        studentId: "s-1",
        usn: "1BM22CS001",
        name: "Keshav",
        sectionName: "PB",
      },
      { studentId: "s-2", usn: "1BM22CS002", name: "Rahul", sectionName: "PB" },
    ],
  };

  test("shows the correct group, faculty, section and students", () => {
    const model = buildGroupDetailModel(
      detail,
      { "eb-1": "f-1" },
      FACULTY_OPTIONS
    );
    expect(model.groupName).toBe("G-001");
    expect(model.facultyName).toBe("Ambuja");
    expect(model.sectionName).toBe("PB");
    expect(model.studentsLabel).toBe("2 / 10");
    expect(model.members).toHaveLength(2);
    expect(model.members[0]).toEqual({
      studentId: "s-1",
      usn: "1BM22CS001",
      name: "Keshav",
      sectionName: "PB",
    });
  });

  test("keeps members read-only data (no assignment fields added)", () => {
    const model = buildGroupDetailModel(detail, {}, FACULTY_OPTIONS);
    expect(model.members[0]).not.toHaveProperty("electiveBatchId");
  });

  test("resolves faculty from the shared draft in the dialog", () => {
    const model = buildGroupDetailModel(
      {
        ...detail,
        group: { ...detail.group, facultyId: "f-2", facultyName: "Priya" },
      },
      { "eb-1": "f-1" },
      FACULTY_OPTIONS
    );
    expect(model.facultyName).toBe("Ambuja");
  });
});

describe("buildSavePayload", () => {
  test("combines complete student and faculty state into one payload", () => {
    const payload = buildSavePayload({
      courseId: "c-1",
      electiveMappingVersion: 3,
      localAssignments: { "s-1": "eb-1", "s-2": "eb-2", "s-3": null },
      localFaculty: { "eb-1": "f-1", "eb-2": "f-2" },
      departmentId: "dep-1",
    });
    expect(payload).toEqual({
      courseId: "c-1",
      electiveMappingVersion: 3,
      assignments: [
        { studentId: "s-1", electiveBatchId: "eb-1" },
        { studentId: "s-2", electiveBatchId: "eb-2" },
      ],
      faculty: [
        { electiveBatchId: "eb-1", facultyId: "f-1" },
        { electiveBatchId: "eb-2", facultyId: "f-2" },
      ],
      departmentId: "dep-1",
    });
  });

  test("keeps null faculty entries (unassigned groups still validated)", () => {
    const payload = buildSavePayload({
      courseId: "c-1",
      electiveMappingVersion: 1,
      localAssignments: {},
      localFaculty: { "eb-1": "f-1", "eb-2": null },
    });
    expect(payload.faculty).toEqual([
      { electiveBatchId: "eb-1", facultyId: "f-1" },
      { electiveBatchId: "eb-2", facultyId: null },
    ]);
  });
});

describe("buildExcelPreviewModel", () => {
  const baseInput: ExcelPreviewInput = {
    assignments: [
      { studentId: "s-1", electiveBatchId: "eb-1" },
      { studentId: "s-2", electiveBatchId: "eb-2" },
    ],
    facultyAssignments: [
      { electiveBatchId: "eb-1", facultyId: "f-1" },
      { electiveBatchId: "eb-2", facultyId: "f-2" },
      { electiveBatchId: "eb-3", facultyId: null },
    ],
    students: [
      {
        studentId: "s-1",
        usn: "1BM22CS001",
        name: "Keshav",
        sectionName: "PA",
      },
      { studentId: "s-2", usn: "1BM22CS002", name: "Rahul", sectionName: "PB" },
    ],
    batches: [
      { id: "eb-1", name: "G-001", sectionName: "PA" },
      { id: "eb-2", name: "G-002", sectionName: "PB" },
      { id: "eb-3", name: "G-003", sectionName: null },
    ],
    facultyOptions: FACULTY_OPTIONS,
    currentAssignments: { "s-1": "eb-1" },
    currentFaculty: { "eb-1": "f-1" },
  };

  test("reports changed student groups with previous/next names", () => {
    const model = buildExcelPreviewModel({
      ...baseInput,
      currentAssignments: { "s-1": "eb-1" },
    });
    expect(model.studentChanges).toHaveLength(1);
    expect(model.studentChanges[0]).toEqual({
      studentId: "s-2",
      usn: "1BM22CS002",
      name: "Rahul",
      sectionName: "PB",
      previousGroupName: null,
      nextGroupName: "G-002",
    });
  });

  test("reports changed faculty with previous/next names", () => {
    const model = buildExcelPreviewModel({
      ...baseInput,
      currentFaculty: { "eb-1": "f-1" },
    });
    expect(model.facultyChanges).toHaveLength(1);
    expect(model.facultyChanges[0]).toEqual({
      electiveBatchId: "eb-2",
      groupName: "G-002",
      sectionName: "PB",
      previousFacultyName: null,
      nextFacultyName: "Priya",
    });
  });

  test("unchanged rows are skipped for both dimensions", () => {
    const model = buildExcelPreviewModel({
      ...baseInput,
      currentAssignments: { "s-1": "eb-1", "s-2": "eb-2" },
      currentFaculty: { "eb-1": "f-1", "eb-2": "f-2", "eb-3": null },
    });
    expect(model.studentChanges).toHaveLength(0);
    expect(model.facultyChanges).toHaveLength(0);
  });

  test("zero-student group faculty change is still reported", () => {
    const model = buildExcelPreviewModel({
      ...baseInput,
      assignments: [],
      facultyAssignments: [{ electiveBatchId: "eb-3", facultyId: "f-1" }],
      currentFaculty: { "eb-3": null },
    });
    expect(model.studentChanges).toHaveLength(0);
    expect(model.facultyChanges).toHaveLength(1);
    expect(model.facultyChanges[0]).toEqual({
      electiveBatchId: "eb-3",
      groupName: "G-003",
      sectionName: null,
      previousFacultyName: null,
      nextFacultyName: "Ambuja",
    });
  });

  test("empty assignments and faculty produce an empty model", () => {
    const model = buildExcelPreviewModel({
      ...baseInput,
      assignments: [],
      facultyAssignments: [],
    });
    expect(model.studentChanges).toHaveLength(0);
    expect(model.facultyChanges).toHaveLength(0);
  });

  test("unknown ids fall back to raw ids", () => {
    const model = buildExcelPreviewModel({
      ...baseInput,
      assignments: [{ studentId: "s-x", electiveBatchId: "eb-x" }],
      facultyAssignments: [{ electiveBatchId: "eb-y", facultyId: "f-x" }],
    });
    expect(model.studentChanges[0]).toMatchObject({
      studentId: "s-x",
      usn: "s-x",
      name: "",
      nextGroupName: null,
    });
    expect(model.facultyChanges[0]).toMatchObject({
      groupName: "eb-y",
      nextFacultyName: null,
    });
  });
});
