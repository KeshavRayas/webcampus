import { beforeEach, describe, expect, it, mock } from "bun:test";

const pwCourseFixture = {
  id: "c-pw",
  code: "C4",
  name: "C++",
  courseType: "PW",
  courseMode: "FINAL_SUMMARY",
  approvalStatus: "DRAFT",
  semesterId: "sem-1",
  semesterNumber: 1,
  departmentId: "dept-cse",
  departmentName: "Firstyear",
  cycle: "NONE",
  studentsPerBatch: 2,
  projectGroupingScope: "WITHIN_SECTION",
  numberOfBatches: 0,
  nextProjectGroupSequence: 0,
  electiveMappingVersion: 1,
  semester: { academicTerm: { year: "2026" } },
} as const;

const peCourseFixture = {
  id: "c-pe",
  code: "C1",
  name: "Java1",
  courseType: "PE",
  courseMode: "NON_INTEGRATED",
  approvalStatus: "DRAFT",
  semesterId: "sem-1",
  semesterNumber: 1,
  departmentId: "dept-cse",
  departmentName: "Firstyear",
  cycle: "NONE",
  numberOfBatches: 2,
  studentsPerBatch: 2,
  projectGroupingScope: "WITHIN_SECTION",
  nextProjectGroupSequence: 0,
  electiveMappingVersion: 1,
  semester: { academicTerm: { year: "2026" } },
} as const;

const sectionPA = {
  id: "sec-pa",
  name: "PA",
  semesterId: "sem-1",
  departmentId: "dept-cse",
  cycle: "NONE",
};
const sectionPB = {
  id: "sec-pb",
  name: "PB",
  semesterId: "sem-1",
  departmentId: "dept-cse",
  cycle: "NONE",
};

type DbMock = {
  $transaction: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  $queryRaw: (
    strings: readonly string[],
    ...params: unknown[]
  ) => Promise<Array<Record<string, unknown>>>;
  course: {
    findUnique: (args: {
      where: { id: string };
      include?: unknown;
      select?: unknown;
    }) => Promise<unknown>;
    findMany: (args: {
      where: Record<string, unknown>;
      select?: unknown;
    }) => Promise<unknown[]>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  electiveBatch: {
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<{ id: string }>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  electiveBatchFaculty: {
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  electiveStudentAssignment: {
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  section: {
    findMany: (args: unknown) => Promise<unknown[]>;
    findUnique: (args: {
      where: { id: string };
      select?: unknown;
    }) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
  studentSection: {
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
  batch: { deleteMany: (args: unknown) => Promise<{ count: number }> };
  department: {
    findFirst: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
  student: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

let courseFindManyCalls: Array<{ where: Record<string, unknown> }>;
let electiveBatchCreates: Array<Record<string, unknown>>;
let electiveBatchFindManyArgs: Array<Record<string, unknown>>;
let studentSectionCountArgs: Array<Record<string, unknown>>;
let queryRawCalls: Array<{ strings: readonly string[]; params: unknown[] }>;
let existingBatches: unknown[];
let sections: unknown[];
let sectionPopulation: Map<string, number>;
let createdSection: unknown;
let existingStudentSection: unknown;
let sectionLookup: Map<string, { departmentId: string; semesterId: string }>;
let studentSectionUpdateCalls: number;
let studentSectionDeleteCalls: number;
let studentSectionCreateCalls: number;

let dbMock: DbMock;

beforeEach(() => {
  courseFindManyCalls = [];
  electiveBatchCreates = [];
  electiveBatchFindManyArgs = [];
  studentSectionCountArgs = [];
  queryRawCalls = [];
  existingBatches = [];
  sections = [sectionPA, sectionPB];
  sectionPopulation = new Map([
    ["sec-pa", 3],
    ["sec-pb", 2],
  ]);
  createdSection = {
    id: "sec-new",
    name: "PC",
    semesterId: "sem-1",
    departmentId: "dept-cse",
    cycle: "NONE",
  };
  existingStudentSection = {
    id: "ss-1",
    studentId: "s1",
    sectionId: "sec-pa",
    semester: 1,
    academicYear: "2026",
  };
  sectionLookup = new Map([
    ["sec-pa", { departmentId: "dept-cse", semesterId: "sem-1" }],
    ["sec-pb", { departmentId: "dept-cse", semesterId: "sem-1" }],
  ]);
  studentSectionUpdateCalls = 0;
  studentSectionDeleteCalls = 0;
  studentSectionCreateCalls = 0;

  dbMock = {
    $transaction: async (cb) => cb(dbMock),
    $queryRaw: async (strings, ...params) => {
      queryRawCalls.push({ strings, params });
      return [];
    },
    course: {
      findUnique: async (args) => {
        if (args?.where?.id === "c-pw") return { ...pwCourseFixture };
        if (args?.where?.id === "c-pe") return { ...peCourseFixture };
        return null;
      },
      findMany: async (args) => {
        courseFindManyCalls.push({
          where: args.where as Record<string, unknown>,
        });
        const where = args.where as {
          courseType?: string;
          departmentId?: string;
          semesterId?: string;
        };
        if (where?.courseType === "PE") return [peCourseFixture];
        if (where?.courseType === "PW") return [{ ...pwCourseFixture }];
        return [];
      },
      update: async () => ({}),
      updateMany: async () => ({ count: 1 }),
    },
    electiveBatch: {
      findMany: async (args) => {
        electiveBatchFindManyArgs.push(args as Record<string, unknown>);
        return existingBatches;
      },
      create: async (args) => {
        electiveBatchCreates.push(
          (args as { data: Record<string, unknown> }).data
        );
        return { id: "new-batch" };
      },
      deleteMany: async () => ({ count: 0 }),
    },
    electiveBatchFaculty: { deleteMany: async () => ({ count: 0 }) },
    electiveStudentAssignment: { deleteMany: async () => ({ count: 0 }) },
    section: {
      findMany: async () => sections,
      findUnique: async (args) => {
        const info = sectionLookup.get(args.where.id);
        return info
          ? {
              id: args.where.id,
              ...info,
              department: { id: info.departmentId },
            }
          : null;
      },
      create: async () => createdSection,
      delete: async () => ({}),
    },
    studentSection: {
      create: async (args) => {
        studentSectionCreateCalls += 1;
        const data = (args as { data: Record<string, unknown> }).data;
        const secId = data.sectionId as string;
        const key = `${secId}:${data.semester ?? 1}:${data.academicYear ?? "2026"}`;
        sectionPopulation.set(key, (sectionPopulation.get(key) ?? 0) + 1);
        return { id: "ss-new", ...data };
      },
      update: async (args) => {
        studentSectionUpdateCalls += 1;
        return args;
      },
      delete: async () => {
        studentSectionDeleteCalls += 1;
        return {};
      },
      deleteMany: async () => ({ count: 0 }),
      createMany: async (args) => ({
        count: (args as { data: unknown[] }).data.length,
      }),
      findUnique: async () => existingStudentSection,
      count: async (args) => {
        studentSectionCountArgs.push(args as Record<string, unknown>);
        const where = args as { where: { sectionId: string } };
        return sectionPopulation.get(where.where.sectionId) ?? 0;
      },
    },
    batch: { deleteMany: async () => ({ count: 0 }) },
    department: {
      findFirst: async () => ({ id: "dept-cse", name: "CSE" }),
      findUnique: async () => ({
        id: "dept-cse",
        name: "CSE",
        type: "DEGREE_GRANTING",
      }),
    },
    student: {
      findUnique: async () => ({
        id: "s1",
        department: { id: "dept-cse" },
      }),
    },
  };

  mock.module("@webcampus/db", () => ({
    db: dbMock,
    Prisma: {
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;
        constructor(code: string) {
          super("prisma error");
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
    PrismaClient: class PrismaClient {
      constructor() {
        return dbMock;
      }
    },
  }));
  mock.module("@webcampus/common/logger", () => ({
    logger: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    },
  }));
  mock.module(
    "@webcampus/api/src/services/shared/department-context-resolver.service",
    () => ({
      DepartmentContextResolver: {
        resolve: async () => ({
          departmentId: "dept-cse",
          departmentName: "Firstyear",
        }),
      },
    })
  );
});

const { ProjectMappingService } = await import("../project-mapping.service");
const { SectionAssignment } = await import("../section-assignment.service");
const { SectionService } = await import("../section.service");

type LifecycleTx = Parameters<
  typeof ProjectMappingService.syncProjectGroups
>[0]["tx"];

describe("ProjectMappingService.reconcileProjectGroupsForScope", () => {
  it("queries only PW courses in the dept/semester scope", async () => {
    await ProjectMappingService.reconcileProjectGroupsForScope({
      tx: dbMock as unknown as LifecycleTx,
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
    expect(courseFindManyCalls).toHaveLength(1);
    expect(courseFindManyCalls[0]?.where).toEqual({
      courseType: "PW",
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
  });

  it("takes the Course FOR UPDATE lock before reading existing batches", async () => {
    await ProjectMappingService.reconcileProjectGroupsForScope({
      tx: dbMock as unknown as LifecycleTx,
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
    expect(queryRawCalls.length).toBeGreaterThan(0);
    expect(queryRawCalls[0]?.strings.join("")).toContain("FOR UPDATE");
    expect(electiveBatchFindManyArgs.length).toBeGreaterThan(0);
  });

  it("creates per-section groups (PA=3 students, spp=2 â†’ 2 groups; PB=2 â†’ 1 group)", async () => {
    await ProjectMappingService.reconcileProjectGroupsForScope({
      tx: dbMock as unknown as LifecycleTx,
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
    const names = electiveBatchCreates.map((c) => c.name).sort();
    expect(names).toEqual(["G-001", "G-002", "G-003"]);
  });

  it("is idempotent when groups already exist", async () => {
    existingBatches = [
      {
        id: "g1",
        name: "G-001",
        sortOrder: 1,
        sectionId: "sec-pa",
        studentAssignments: 0,
        attendances: 0,
        attendanceRecords: 0,
        classSessions: 0,
        facultyAssignment: null,
      },
      {
        id: "g2",
        name: "G-002",
        sortOrder: 2,
        sectionId: "sec-pa",
        studentAssignments: 0,
        attendances: 0,
        attendanceRecords: 0,
        classSessions: 0,
        facultyAssignment: null,
      },
      {
        id: "g3",
        name: "G-003",
        sortOrder: 3,
        sectionId: "sec-pb",
        studentAssignments: 0,
        attendances: 0,
        attendanceRecords: 0,
        classSessions: 0,
        facultyAssignment: null,
      },
    ];
    await ProjectMappingService.reconcileProjectGroupsForScope({
      tx: dbMock as unknown as LifecycleTx,
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
    expect(electiveBatchCreates).toHaveLength(0);
  });

  it("does not touch PE courses (isolation)", async () => {
    await ProjectMappingService.reconcileProjectGroupsForScope({
      tx: dbMock as unknown as LifecycleTx,
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
    const peCalls = courseFindManyCalls.filter(
      (c) => (c.where as { courseType?: string }).courseType === "PE"
    );
    expect(peCalls).toHaveLength(0);
    expect(
      electiveBatchCreates.every((c) => String(c.name).startsWith("G-"))
    ).toBe(true);
  });
});

describe("ProjectMappingService.syncProjectGroups FOR UPDATE lock", () => {
  it("locks the Course row before computing nextSequence", async () => {
    await ProjectMappingService.syncProjectGroups({
      tx: dbMock as unknown as LifecycleTx,
      courseId: "c-pw",
      studentsPerGroup: 2,
      groupingScope: "WITHIN_SECTION",
      targetGroupCount: null,
    });
    expect(queryRawCalls.length).toBeGreaterThan(0);
    const lockCall = queryRawCalls.find((c) =>
      c.strings.join("").includes("FOR UPDATE")
    );
    expect(lockCall).toBeDefined();
    expect(lockCall?.params).toContain("c-pw");
  });
});

describe("SectionAssignment lifecycle reconcile", () => {
  it("create wraps in a transaction and reconciles the new section scope", async () => {
    await SectionAssignment.create({
      studentId: "s1",
      sectionId: "sec-pa",
      semester: 1,
      academicYear: "2026",
    } as never);
    expect(studentSectionCreateCalls).toBe(1);
    expect(courseFindManyCalls.length).toBeGreaterThan(0);
    expect(courseFindManyCalls[0]?.where).toEqual({
      courseType: "PW",
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
  });

  it("update reconciles OLD and NEW section scopes when sectionId changes", async () => {
    existingStudentSection = {
      id: "ss-1",
      studentId: "s1",
      sectionId: "sec-pa",
      semester: 1,
      academicYear: "2026",
    };
    await SectionAssignment.update("ss-1", { sectionId: "sec-pb" } as never);
    expect(studentSectionUpdateCalls).toBe(1);
    expect(courseFindManyCalls.length).toBeGreaterThan(0);
  });

  it("delete wraps in a transaction and reconciles the deleted section scope", async () => {
    await SectionAssignment.delete("ss-1");
    expect(studentSectionDeleteCalls).toBe(1);
    expect(courseFindManyCalls.length).toBeGreaterThan(0);
  });
});

describe("SectionService.create reconcile", () => {
  it("creates the section and reconciles the new scope in one transaction", async () => {
    const res = await SectionService.create({
      name: "PC",
      semesterId: "sem-1",
      departmentId: "dept-cse",
    } as never);
    expect(res.status).toBe("success");
    expect(courseFindManyCalls.length).toBeGreaterThan(0);
    expect(courseFindManyCalls[0]?.where).toEqual({
      courseType: "PW",
      departmentId: "dept-cse",
      semesterId: "sem-1",
    });
  });
});
