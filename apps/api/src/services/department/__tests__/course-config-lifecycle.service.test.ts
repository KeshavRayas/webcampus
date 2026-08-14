/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

let courseFixture: Record<string, unknown>;
let registrationCount = 0;
let hasAttendanceOrMarks = false;
let windowOpenFixture = false;
let sectionsFixture: { id: string; name: string }[];
let electiveBatchCreates = 0;
let electiveBatchDeleteManyCalls = 0;
let courseUpdateCalls = 0;
let semesterTarget: Record<string, unknown> | null;

interface ConfigLifecycleDb {
  $transaction: <T>(fn: (tx: ConfigLifecycleDb) => Promise<T>) => Promise<T>;
  department: { findFirst: () => Promise<{ id: string } | null> };
  course: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<Record<string, unknown> | null>;
    findFirst: (args: {
      where?: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<Record<string, unknown>>;
    updateMany: () => Promise<{ count: number }>;
  };
  courseRegistration: { count: () => Promise<number> };
  courseAssignment: { count: () => Promise<number> };
  attendance: { findFirst: () => Promise<{ id: string } | null> };
  mark: { findFirst: () => Promise<{ id: string } | null> };
  classSession: { findFirst: () => Promise<{ id: string } | null> };
  registrationWindow: { findFirst: () => Promise<{ id: string } | null> };
  semester: {
    findUnique: (args: {
      where: { id: string };
      include: { academicTerm: boolean };
    }) => Promise<Record<string, unknown> | null>;
  };
  section: { findMany: () => Promise<typeof sectionsFixture> };
  studentSection: { count: () => Promise<number> };
  electiveBatch: {
    findMany: () => Promise<unknown[]>;
    count: () => Promise<number>;
    create: () => Promise<{ id: string }>;
    deleteMany: () => Promise<{ count: number }>;
  };
  electiveBatchFaculty: { deleteMany: () => Promise<{ count: number }> };
  electiveStudentAssignment: { deleteMany: () => Promise<{ count: number }> };
  openElectiveDepartment: {
    deleteMany: () => Promise<{ count: number }>;
    createMany: () => Promise<{ count: number }>;
  };
}

const dbMock: ConfigLifecycleDb = {
  $transaction: async (fn) => fn(dbMock),
  department: {
    findFirst: async () => ({ id: "dep-1" }),
  },
  course: {
    findUnique: async ({ where }) =>
      where.id === courseFixture.id ? courseFixture : null,
    findFirst: async () => courseFixture,
    update: async () => {
      courseUpdateCalls++;
      return courseFixture;
    },
    updateMany: async () => ({ count: 1 }),
  },
  courseRegistration: { count: async () => registrationCount },
  courseAssignment: { count: async () => 0 },
  attendance: {
    findFirst: async () => (hasAttendanceOrMarks ? { id: "a1" } : null),
  },
  mark: { findFirst: async () => (hasAttendanceOrMarks ? { id: "m1" } : null) },
  classSession: {
    findFirst: async () => (hasAttendanceOrMarks ? { id: "c1" } : null),
  },
  registrationWindow: {
    findFirst: async () => (windowOpenFixture ? { id: "w1" } : null),
  },
  semester: {
    findUnique: async () => semesterTarget,
  },
  section: { findMany: async () => sectionsFixture },
  studentSection: {
    count: async () => {
      // population is driven per-section via the current section id; the test
      // asserts against the aggregate below through sectionsFixture + counts.
      return 0;
    },
  },
  electiveBatch: {
    findMany: async () => [],
    count: async () => 0,
    create: async () => {
      electiveBatchCreates++;
      return { id: `g-${electiveBatchCreates}` };
    },
    deleteMany: async () => {
      electiveBatchDeleteManyCalls++;
      return { count: 0 };
    },
  },
  electiveBatchFaculty: { deleteMany: async () => ({ count: 0 }) },
  electiveStudentAssignment: { deleteMany: async () => ({ count: 0 }) },
  openElectiveDepartment: {
    deleteMany: async () => ({ count: 0 }),
    createMany: async () => ({ count: 0 }),
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string) {
        super(message);
        this.code = "P2002";
      }
    },
  },
  PrismaClient: class {
    constructor() {
      return dbMock;
    }
  },
  CourseApprovalStatus: {
    DRAFT: "DRAFT",
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
  EligibilityStatus: { ELIGIBLE: "ELIGIBLE", NOT_ELIGIBLE: "NOT_ELIGIBLE" },
  Cycle: { PHYSICS: "PHYSICS", CHEMISTRY: "CHEMISTRY", NONE: "NONE" },
  Designation: {},
  DepartmentType: {},
  SemesterType: {},
  AuditAction: {},
  AuditEntityType: {},
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    log: () => {},
  },
}));

const { CourseService } = await import("../course.service");

const makePwCourse = (overrides: Record<string, unknown> = {}) => ({
  id: "course-pw",
  code: "PW101",
  name: "PW 101",
  courseType: "PW",
  courseMode: "FINAL_SUMMARY",
  approvalStatus: "DRAFT",
  departmentId: "dep-1",
  departmentName: "CSE",
  semesterId: "sem-1",
  semesterNumber: 3,
  cycle: "NONE",
  numberOfBatches: 5,
  studentsPerBatch: 4,
  projectGroupingScope: "WITHIN_SECTION",
  openElectiveEligibility: "ALL",
  version: 1,
  lectureCredits: 0,
  tutorialCredits: 0,
  practicalCredits: 0,
  skillCredits: 0,
  labMaxMarks: 0,
  ...overrides,
});

beforeEach(() => {
  registrationCount = 0;
  hasAttendanceOrMarks = false;
  windowOpenFixture = false;
  sectionsFixture = [];
  electiveBatchCreates = 0;
  electiveBatchDeleteManyCalls = 0;
  courseUpdateCalls = 0;
  semesterTarget = null;
  courseFixture = makePwCourse();
});

describe("CourseService.updateCourse — PW configuration lifecycle (Phase 3)", () => {
  describe("scope-aware capacity guard", () => {
    it("rejects DEPARTMENT_WIDE numberOfGroups reduction that strands registrations", async () => {
      courseFixture = makePwCourse({
        numberOfBatches: 10,
        studentsPerBatch: 4,
        projectGroupingScope: "DEPARTMENT_WIDE",
      });
      registrationCount = 30;

      await expect(
        CourseService.updateCourse("course-pw", {
          id: "course-pw",
          numberOfBatches: 7, // 7 × 4 = 28 < 30 registered
        })
      ).rejects.toThrow(
        "Cannot change Project / Mini-Project (PW) configuration: effective capacity 28 is below 30 registered students"
      );
      expect(electiveBatchCreates).toBe(0);
      expect(courseUpdateCalls).toBe(0);
    });

    it("allows DEPARTMENT_WIDE numberOfGroups reduction that still fits registrations", async () => {
      courseFixture = makePwCourse({
        numberOfBatches: 10,
        studentsPerBatch: 4,
        projectGroupingScope: "DEPARTMENT_WIDE",
      });
      registrationCount = 28;

      await expect(
        CourseService.updateCourse("course-pw", {
          id: "course-pw",
          numberOfBatches: 8,
        })
      ).resolves.toBeDefined();
      // course.update runs once for the course edit + once inside
      // syncProjectGroups' final reconcile.
      expect(courseUpdateCalls).toBeGreaterThanOrEqual(1);
    });

    it("rejects WITHIN_SECTION studentsPerBatch reduction via derived per-section groups", async () => {
      courseFixture = makePwCourse({
        studentsPerBatch: 6,
        projectGroupingScope: "WITHIN_SECTION",
      });
      sectionsFixture = [{ id: "sec-a", name: "3A" }];
      registrationCount = 12;

      await expect(
        CourseService.updateCourse("course-pw", {
          id: "course-pw",
          studentsPerBatch: 2,
        })
      ).rejects.toThrow(
        "Cannot change Project / Mini-Project (PW) configuration"
      );
      expect(courseUpdateCalls).toBe(0);
    });

    it("rejects scope change (semesterId) that reduces effective capacity below registrations", async () => {
      courseFixture = makePwCourse({
        studentsPerBatch: 4,
        projectGroupingScope: "WITHIN_SECTION",
      });
      sectionsFixture = [{ id: "sec-new", name: "3B" }];
      semesterTarget = {
        id: "sem-2",
        academicTerm: { year: "2026" },
      };
      registrationCount = 10;

      await expect(
        CourseService.updateCourse("course-pw", {
          id: "course-pw",
          semesterId: "sem-2",
        })
      ).rejects.toThrow(
        "Cannot change Project / Mini-Project (PW) configuration"
      );
      expect(courseUpdateCalls).toBe(0);
    });
  });

  describe("post-attendance/marks lock (every PW config field)", () => {
    const configFields: { label: string; data: Record<string, unknown> }[] = [
      { label: "studentsPerBatch", data: { studentsPerBatch: 5 } },
      { label: "numberOfGroups", data: { numberOfBatches: 6 } },
      {
        label: "projectGroupingScope",
        data: { projectGroupingScope: "DEPARTMENT_WIDE" },
      },
      { label: "cycle", data: { cycle: "PHYSICS" } },
      { label: "semesterId", data: { semesterId: "sem-2" } },
      { label: "semesterNumber", data: { semesterNumber: 4 } },
      { label: "departmentId", data: { departmentId: "dep-2" } },
      { label: "departmentName", data: { departmentName: "ECE" } },
    ];

    for (const { label, data } of configFields) {
      it(`rejects ${label} change after attendance/marks exist`, async () => {
        hasAttendanceOrMarks = true;
        registrationCount = 1;

        await expect(
          CourseService.updateCourse("course-pw", {
            id: "course-pw",
            ...data,
          })
        ).rejects.toThrow(
          "Cannot change Project / Mini-Project (PW) group configuration after attendance or marks exist"
        );
        expect(electiveBatchCreates).toBe(0);
        expect(electiveBatchDeleteManyCalls).toBe(0);
        expect(courseUpdateCalls).toBe(0);
      });
    }

    it("keeps the existing PE batch-config lock intact (regression: PE unchanged)", async () => {
      courseFixture = makePwCourse({
        courseType: "PE",
        courseMode: "NON_INTEGRATED",
        numberOfBatches: 4,
        studentsPerBatch: 5,
        projectGroupingScope: "WITHIN_SECTION",
      });
      hasAttendanceOrMarks = true;
      registrationCount = 1;

      // PE config changes were already locked after attendance/marks before
      // Phase 3; the guard must still fire with the PE wording.
      await expect(
        CourseService.updateCourse("course-pe", {
          id: "course-pe",
          numberOfBatches: 5,
        })
      ).rejects.toThrow(
        "Cannot change PE batch configuration after attendance or marks exist"
      );
      expect(courseUpdateCalls).toBe(0);
    });

    it("does NOT apply the lock to a PC course update", async () => {
      courseFixture = makePwCourse({
        id: "course-pc",
        code: "CS101",
        name: "CS 101",
        courseType: "PC",
        courseMode: "INTEGRATED",
        numberOfBatches: null,
        studentsPerBatch: null,
        projectGroupingScope: "WITHIN_SECTION",
      });
      hasAttendanceOrMarks = true;

      const res = await CourseService.updateCourse("course-pc", {
        id: "course-pc",
        name: "CS 101 Updated",
      });
      expect(res).toBeDefined();
      expect(courseUpdateCalls).toBe(1);
    });
  });

  describe("registration-window lock", () => {
    it("rejects a PW config change while registration is open and students registered", async () => {
      windowOpenFixture = true;
      registrationCount = 2;

      await expect(
        CourseService.updateCourse("course-pw", {
          id: "course-pw",
          studentsPerBatch: 6,
        })
      ).rejects.toThrow(
        "Cannot change Project / Mini-Project (PW) group configuration while registration is open and students have registered"
      );
      expect(courseUpdateCalls).toBe(0);
    });
  });

  describe("syncProjectGroups re-run on section-scope change", () => {
    it("re-runs group sync (creates groups) when the scope fields change", async () => {
      courseFixture = makePwCourse({
        projectGroupingScope: "WITHIN_SECTION",
      });
      sectionsFixture = [{ id: "sec-a", name: "3A" }];

      const res = await CourseService.updateCourse("course-pw", {
        id: "course-pw",
        cycle: "PHYSICS",
      });
      expect(res).toBeDefined();
      // syncProjectGroups ran inside the transaction and created a derived group
      // (max(1, ceil(population/studentsPerGroup)) for the one section).
      expect(electiveBatchCreates).toBeGreaterThan(0);
    });
  });

  describe("syncProjectGroups NOT re-run when scope unchanged", () => {
    it("does not create groups when only a non-scope field changes (e.g. name)", async () => {
      courseFixture = makePwCourse({});
      sectionsFixture = [];

      const res = await CourseService.updateCourse("course-pw", {
        id: "course-pw",
        name: "PW 101 Updated",
      });
      expect(res).toBeDefined();
      expect(electiveBatchCreates).toBe(0);
    });
  });
});
