import { describe, expect, it, mock } from "bun:test";

const peFixture = {
  id: "pe-1",
  code: "PE101",
  name: "PE 101",
  courseType: "PE",
  numberOfBatches: 2,
  studentsPerBatch: 30,
  electiveMappingVersion: 1,
  electiveBatches: [{ id: "b1", facultyAssignment: { id: "f1" } }],
  _count: { registrations: 10, electiveStudentAssignments: 8 },
};

const pwFixture = {
  id: "pw-1",
  code: "PW101",
  name: "PW 101",
  courseType: "PW",
  projectGroupingScope: "DEPARTMENT_WIDE",
  numberOfBatches: 3,
  studentsPerBatch: 5,
  electiveMappingVersion: 2,
  electiveBatches: [
    { id: "g1", facultyAssignment: { id: "f1" } },
    { id: "g2", facultyAssignment: { id: "f2" } },
  ],
  _count: { registrations: 10, electiveStudentAssignments: 7 },
};

let courseFindManyWhere: Record<string, unknown> | null = null;

const dbMock = {
  department: {
    findFirst: async () => ({ id: "dept-cse", name: "CSE" }),
  },
  course: {
    findMany: async (args: { where?: { courseType?: string } }) => {
      courseFindManyWhere = (args?.where as Record<string, unknown>) ?? null;
      if (args?.where?.courseType === "PE") return [peFixture];
      if (args?.where?.courseType === "PW") return [pwFixture];
      return [];
    },
  },
  attendance: { findFirst: async () => null },
  mark: { findFirst: async () => null },
  classSession: { findFirst: async () => null },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.code = code;
      }
    },
  },
  CourseApprovalStatus: {
    DRAFT: "DRAFT",
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
  Designation: {},
  Cycle: { PHYSICS: "PHYSICS", CHEMISTRY: "CHEMISTRY", NONE: "NONE" },
  PrismaClient: class {
    constructor() {
      return dbMock;
    }
  },
}));

mock.module("@webcampus/common/logger", () => ({
  logger: { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} },
}));

const { ElectiveMappingService } = await import("../elective-mapping.service");
const { ProjectMappingService } = await import("../project-mapping.service");

describe("ElectiveMappingService.listPeCourses DTO + filter contract (Phase 6)", () => {
  it("returns rows carrying courseType 'PE'", async () => {
    const res = (await ElectiveMappingService.listPeCourses(
      "sem-1",
      "user-1",
      undefined
    )) as { data: Array<Record<string, unknown>> };
    expect(res.data[0]!.courseType).toBe("PE");
    expect(res.data[0]!.code).toBe("PE101");
    expect(res.data[0]!.registeredCount).toBe(10);
    expect(res.data[0]!.capacity).toBe(60);
    expect(res.data[0]!.seatsLeft).toBe(50);
    expect(res.data[0]!.facultyMappingComplete).toBe(true);
    expect(res.data[0]!.electiveMappingComplete).toBe(false);
  });

  it("queries only courseType 'PE' (PE appears when it should, never returns non-PE)", async () => {
    const res = (await ElectiveMappingService.listPeCourses(
      "sem-1",
      "user-1",
      undefined
    )) as { data: Array<Record<string, unknown>> };
    expect(courseFindManyWhere).toEqual({
      semesterId: "sem-1",
      departmentId: "dept-cse",
      courseType: "PE",
    });
    expect(res.data).toHaveLength(1);
    expect(res.data.every((row) => row.courseType === "PE")).toBe(true);
  });
});

describe("ProjectMappingService.listCourses DTO + filter contract (Phase 6)", () => {
  it("returns rows carrying courseType 'PW' and electiveAssignedCount", async () => {
    const res = (await ProjectMappingService.listCourses(
      "sem-1",
      "user-1",
      undefined
    )) as { data: Array<Record<string, unknown>> };
    expect(res.data[0]!.courseType).toBe("PW");
    expect(res.data[0]!.code).toBe("PW101");
    expect(res.data[0]!.numberOfGroups).toBe(2);
    expect(res.data[0]!.registeredCount).toBe(10);
    expect(res.data[0]!.electiveAssignedCount).toBe(7);
    expect(res.data[0]!.facultyMappingComplete).toBe(true);
    expect(res.data[0]!.electiveMappingComplete).toBe(false);
  });

  it("queries only courseType 'PW' (PW appears when it should, never returns non-PW)", async () => {
    const res = (await ProjectMappingService.listCourses(
      "sem-1",
      "user-1",
      undefined
    )) as { data: Array<Record<string, unknown>> };
    expect(courseFindManyWhere).toEqual({
      semesterId: "sem-1",
      departmentId: "dept-cse",
      courseType: "PW",
    });
    expect(res.data).toHaveLength(1);
    expect(res.data.every((row) => row.courseType === "PW")).toBe(true);
  });
});
