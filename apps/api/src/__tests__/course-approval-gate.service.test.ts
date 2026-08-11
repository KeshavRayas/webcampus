/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

let coursesFixture: Record<string, unknown>[];
let peScopeFixture: Record<string, unknown>[];
let batchesFixture: Array<{
  id: string;
  facultyAssignment: {
    id: string;
    semester: number;
    academicYear: string;
  } | null;
}>;
let updateManyCalls: unknown[];
let eligibleCount = 0;
let registrationCountForCourse = 0;
let windowOpenFixture = false;
let useRegStore = false;
let studentsFixture: Record<string, Record<string, unknown>> = {};
let regCoursesFixture: Record<string, unknown>[] = [];
let regStore: {
  registrations: {
    studentId: string;
    courseId: string;
    semesterId: string;
    academicTermId: string;
  }[];
  assignments: {
    studentId: string;
    courseId: string;
    electiveBatchId: string;
  }[];
} = { registrations: [], assignments: [] };

interface ApprovalGateDb {
  $transaction: <T>(fn: (tx: ApprovalGateDb) => Promise<T>) => Promise<T>;
  $queryRaw: (strings: unknown, ...values: unknown[]) => Promise<unknown[]>;
  department: {
    findFirst: () => Promise<{ id: string } | null>;
    findUnique: () => Promise<{ name: string } | null>;
  };
  section: { findMany: () => Promise<unknown[]> };
  course: {
    findMany: (args: {
      where?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) => Promise<Record<string, unknown>[]>;
    findUnique: (args: {
      where: { id: string };
    }) => Promise<Record<string, unknown> | null>;
    update: (args: unknown) => Promise<Record<string, unknown>>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  electiveBatch: {
    findMany: () => Promise<typeof batchesFixture>;
    findUnique: (args: {
      where: { id: string };
    }) => Promise<Record<string, unknown> | null>;
    count: () => Promise<number>;
  };
  electiveStudentAssignment: {
    count: (args: { where: { electiveBatchId: string } }) => Promise<number>;
    create: (args: {
      data: {
        courseId: string;
        studentId: string;
        electiveBatchId: string;
      };
    }) => Promise<{ id: string }>;
  };
  student: {
    findUnique: (args: {
      where: { userId: string };
    }) => Promise<Record<string, unknown> | null>;
    count: () => Promise<number>;
  };
  courseRegistration: {
    count: (args: { where?: Record<string, unknown> }) => Promise<number>;
    createMany: (args: {
      data: Record<string, unknown>[];
    }) => Promise<{ count: number }>;
  };
  registrationWindow: {
    findFirst: () => Promise<{ id: string; isOpen?: boolean } | null>;
  };
}

const lockGates = new Map<string, Promise<void>>();

function acquireLock(id: string): { wait: Promise<void>; release: () => void } {
  const prev = lockGates.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  lockGates.set(id, gate);
  return { wait: prev, release };
}

const dbMock: ApprovalGateDb = {
  $transaction: async (fn) => {
    const acquired: Array<() => void> = [];
    let snapshotTaken = false;
    let snapshot: {
      registrations: typeof regStore.registrations;
      assignments: typeof regStore.assignments;
    } = { registrations: [], assignments: [] };
    const tx: ApprovalGateDb = {
      ...dbMock,
      $queryRaw: async (_strings, ...values) => {
        const lockId = (values[0] as string) ?? "global";
        const { wait, release } = acquireLock(lockId);
        acquired.push(release);
        await wait;
        // Snapshot only AFTER the row lock is acquired. The lock serializes on
        // the previous holder's commit, so this captures the true committed
        // baseline (winner's rows included). Rollback therefore undoes only
        // this transaction's own partial writes, like real Postgres.
        if (!snapshotTaken) {
          snapshotTaken = true;
          snapshot = {
            registrations: [...regStore.registrations],
            assignments: [...regStore.assignments],
          };
        }
        return [];
      },
    };
    try {
      return await fn(tx);
    } catch (error) {
      if (snapshotTaken) {
        regStore.registrations = snapshot.registrations;
        regStore.assignments = snapshot.assignments;
      }
      throw error;
    } finally {
      for (const release of acquired) release();
    }
  },
  $queryRaw: async () => [],
  department: {
    findFirst: async () => ({ id: "dep-1" }),
    findUnique: async () => ({ id: "dep-1", name: "Computer Science" }),
  },
  section: {
    findMany: async () => [],
  },
  course: {
    findMany: async (
      args: {
        where?: Record<string, unknown>;
        select?: Record<string, unknown>;
      } = {}
    ) => {
      if (useRegStore) {
        // Faithful simulation of getApprovedInstanceCourses where-clause:
        // department-scoped students get OR[own dept, courseType OE] so that
        // cross-department Open Electives are fetched and then filtered by the
        // OE visibility strategy in JS.
        const where = args.where ?? {};
        let list = regCoursesFixture;
        const orClause = where.OR as Array<Record<string, unknown>> | undefined;
        if (orClause) {
          list = list.filter((course) =>
            orClause.some((cond) =>
              cond.departmentId
                ? (course as Record<string, unknown>).departmentId ===
                  cond.departmentId
                : cond.courseType ===
                  (course as Record<string, unknown>).courseType
            )
          );
        } else if (where.departmentId) {
          list = list.filter(
            (course) =>
              (course as Record<string, unknown>).departmentId ===
              where.departmentId
          );
        }
        return list;
      }
      // sumPeCapacityInScope always filters by courseType: "PE" and optionally statuses
      if (args.where?.courseType === "PE") {
        const statuses = (
          args.where.approvalStatus as { in?: string[] } | undefined
        )?.in;
        if (!statuses) return peScopeFixture;
        return peScopeFixture.filter((c) =>
          statuses.includes(c.approvalStatus as string)
        );
      }
      return coursesFixture;
    },
    findUnique: async () => null,
    update: async () => ({}),
    updateMany: async (args: unknown) => {
      updateManyCalls.push(args);
      return { count: coursesFixture.length };
    },
  },
  electiveBatch: {
    findMany: async () => batchesFixture,
    findUnique: async () => null,
    count: async () => batchesFixture.length,
  },
  electiveStudentAssignment: {
    count: async ({ where }) =>
      regStore.assignments.filter(
        (a) => a.electiveBatchId === where.electiveBatchId
      ).length,
    create: async ({ data }) => {
      const row = data as {
        studentId: string;
        courseId: string;
        electiveBatchId: string;
      };
      regStore.assignments.push(row);
      return { id: "esa-1" };
    },
  },
  student: {
    findUnique: async ({ where }) => studentsFixture[where.userId] ?? null,
    count: async () => eligibleCount,
  },
  courseRegistration: {
    count: async (args: { where?: Record<string, unknown> } = {}) => {
      if (!useRegStore) return registrationCountForCourse;
      const where = args.where ?? {};
      if (where.courseId) {
        return regStore.registrations.filter(
          (r) => r.courseId === where.courseId
        ).length;
      }
      return regStore.registrations.filter(
        (r) =>
          r.studentId === where.studentId &&
          r.semesterId === where.semesterId &&
          r.academicTermId === where.academicTermId
      ).length;
    },
    createMany: async ({ data }) => {
      for (const row of data) {
        const existing = regStore.registrations.some(
          (r) => r.studentId === row.studentId && r.courseId === row.courseId
        );
        if (existing) {
          throw new MockPrismaClientKnownRequestError(
            "Unique constraint failed",
            { code: "P2002" }
          );
        }
        regStore.registrations.push(
          row as (typeof regStore)["registrations"][number]
        );
      }
      return { count: data.length };
    },
  },
  registrationWindow: {
    findFirst: async () =>
      useRegStore && windowOpenFixture ? { id: "w1", isOpen: true } : null,
  },
};

class MockPrismaClient {
  constructor() {
    return dbMock;
  }
}

class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, options: { code: string }) {
    super(message);
    this.code = options.code;
  }
}

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
  PrismaClient: MockPrismaClient,
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

const { CourseService } = await import("../services/department/course.service");
const { PeCapacityService } = await import(
  "../services/shared/pe-capacity.service"
);
const { CourseRegistration } = await import(
  "../services/student/course-registration.service"
);

const pcCourse = {
  id: "course-pc",
  code: "CS101",
  name: "CS 101",
  courseType: "PC",
  semesterId: "sem-1",
  semester: { semesterNumber: 3, academicTerm: { year: "2026" } },
  _count: { assignments: 2, coordinators: 1 },
};

const peCourse = {
  id: "course-pe",
  code: "PE101",
  name: "PE 101",
  courseType: "PE",
  semesterId: "sem-1",
  semester: { semesterNumber: 3, academicTerm: { year: "2026" } },
  _count: { assignments: 0, coordinators: 1 },
};

const oeCourse = {
  id: "course-oe",
  code: "OE101",
  name: "OE 101",
  courseType: "OE",
  semesterId: "sem-1",
  semester: { semesterNumber: 3, academicTerm: { year: "2026" } },
  _count: { assignments: 0, coordinators: 1 },
};

const makePe = (
  id: string,
  code: string,
  numberOfBatches: number,
  studentsPerBatch: number,
  approvalStatus: string
) => ({
  id,
  code,
  name: code,
  courseType: "PE",
  semesterId: "sem-1",
  semester: { semesterNumber: 3, academicTerm: { year: "2026" } },
  _count: { assignments: 0, coordinators: 1 },
  numberOfBatches,
  studentsPerBatch,
  approvalStatus,
});

describe("CourseService approval + submit PE mapping gate", () => {
  beforeEach(() => {
    updateManyCalls = [];
    coursesFixture = [];
    peScopeFixture = [];
    batchesFixture = [];
    eligibleCount = 0;
    registrationCountForCourse = 0;
    windowOpenFixture = false;
    useRegStore = false;
    studentsFixture = {};
    regCoursesFixture = [];
    regStore = { registrations: [], assignments: [] };
    lockGates.clear();
  });

  describe("approveSemesterCourses", () => {
    it("blocks approval when a PE has an unmapped batch and flips nothing", async () => {
      coursesFixture = [peCourse];
      batchesFixture = [{ id: "b1", facultyAssignment: null }];

      await expect(
        CourseService.approveSemesterCourses("sem-1", "dep-1")
      ).rejects.toThrow("Cannot approve PE101: PE faculty mapping incomplete");
      expect(updateManyCalls.length).toBe(0);
    });

    it("blocks approval when the only faculty mapping is for a different semester/year", async () => {
      coursesFixture = [peCourse];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 2, academicYear: "2025" },
        },
      ];

      await expect(
        CourseService.approveSemesterCourses("sem-1", "dep-1")
      ).rejects.toThrow("PE faculty mapping incomplete");
      expect(updateManyCalls.length).toBe(0);
    });

    it("approves when every PE batch is mapped for the current semester/year", async () => {
      coursesFixture = [peCourse];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];

      const result = await CourseService.approveSemesterCourses(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(result.data).toEqual({ count: 1 });
      expect(updateManyCalls.length).toBe(1);
      const args = updateManyCalls[0] as {
        data: { approvalStatus: string };
      };
      expect(args.data.approvalStatus).toBe("APPROVED");
    });

    it("leaves a non-PE semester unchanged in behavior", async () => {
      coursesFixture = [pcCourse];

      const result = await CourseService.approveSemesterCourses(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
    });
  });

  describe("bulkSubmitForApproval", () => {
    it("blocks submit when a PE has an unmapped batch and flips nothing", async () => {
      coursesFixture = [peCourse];
      batchesFixture = [{ id: "b1", facultyAssignment: null }];

      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow(
        "PE faculty mapping incomplete (every elective batch needs one faculty)"
      );
      expect(updateManyCalls.length).toBe(0);
    });

    it("submits when the PE is fully mapped for the current semester/year", async () => {
      coursesFixture = [peCourse];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];

      const result = await CourseService.bulkSubmitForApproval(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
      const args = updateManyCalls[0] as {
        data: { approvalStatus: string };
      };
      expect(args.data.approvalStatus).toBe("PENDING");
    });

    it("submits a PC-only scope without PE checks", async () => {
      coursesFixture = [pcCourse];

      const result = await CourseService.bulkSubmitForApproval(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
    });
  });

  describe("OE approval + submit mapping gate (transition boundary)", () => {
    it("blocks submit when an OE has no batches (>=1 batch exists requirement)", async () => {
      coursesFixture = [oeCourse];
      batchesFixture = [];

      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow("OE has no elective batches configured");
      expect(updateManyCalls.length).toBe(0);
    });

    it("blocks approve when an OE has no batches (>=1 batch exists requirement)", async () => {
      coursesFixture = [oeCourse];
      batchesFixture = [];

      await expect(
        CourseService.approveSemesterCourses("sem-1", "dep-1")
      ).rejects.toThrow(
        "Cannot approve OE101: OE has no elective batches configured"
      );
      expect(updateManyCalls.length).toBe(0);
    });

    it("blocks submit when an OE has an unmapped batch", async () => {
      coursesFixture = [oeCourse];
      batchesFixture = [{ id: "b1", facultyAssignment: null }];

      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow(
        "OE faculty mapping incomplete (every elective batch needs one faculty)"
      );
      expect(updateManyCalls.length).toBe(0);
    });

    it("submits an OE when every batch has faculty (DRAFT -> PENDING)", async () => {
      coursesFixture = [oeCourse];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
        {
          id: "b2",
          facultyAssignment: { id: "ebf-2", semester: 3, academicYear: "2026" },
        },
      ];

      const result = await CourseService.bulkSubmitForApproval(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
      const args = updateManyCalls[0] as {
        data: { approvalStatus: string };
      };
      expect(args.data.approvalStatus).toBe("PENDING");
    });

    it("approves a submitted OE when every batch has faculty (PENDING -> APPROVED)", async () => {
      coursesFixture = [oeCourse];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];

      const result = await CourseService.approveSemesterCourses(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
      const args = updateManyCalls[0] as {
        data: { approvalStatus: string };
      };
      expect(args.data.approvalStatus).toBe("APPROVED");
    });

    it("transition boundary: faculty visibility is controlled by approval state, not mapping", async () => {
      // Fully-mapped OE in DRAFT is not visible to faculty (FACULTY_COURSE_STATUS gates
      // faculty dashboards on APPROVED). Submit flips DRAFT -> PENDING (still not visible);
      // approve flips PENDING -> APPROVED (now visible). This test proves the status
      // transitions happen only through bulkSubmitForApproval/approveSemesterCourses and
      // the updateMany payloads carry the correct approvalStatus at each step.
      coursesFixture = [oeCourse];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];

      const submit = await CourseService.bulkSubmitForApproval(
        "sem-1",
        "dep-1"
      );
      expect(submit.status).toBe("success");
      const submitArgs = updateManyCalls[0] as {
        data: { approvalStatus: string };
      };
      expect(submitArgs.data.approvalStatus).toBe("PENDING");

      updateManyCalls = [];

      const approve = await CourseService.approveSemesterCourses(
        "sem-1",
        "dep-1"
      );
      expect(approve.status).toBe("success");
      const approveArgs = updateManyCalls[0] as {
        data: { approvalStatus: string };
      };
      expect(approveArgs.data.approvalStatus).toBe("APPROVED");
    });

    it("does not run the PE aggregate capacity gate for an OE-only scope", async () => {
      coursesFixture = [oeCourse];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];

      const result = await CourseService.bulkSubmitForApproval(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
    });
  });

  describe("bulkSubmitForApproval aggregate PE capacity validation", () => {
    it("succeeds when PENDING+APPROVED siblings + submitting capacity cover eligible students", async () => {
      // PE1 APPROVED cap 40 + PE2 DRAFT cap 20 being submitted; eligible 40
      peScopeFixture = [makePe("pe1", "PE101", 4, 10, "APPROVED")];
      coursesFixture = [makePe("pe2", "PE102", 2, 10, "DRAFT")];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];
      eligibleCount = 40;

      const result = await CourseService.bulkSubmitForApproval(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
      const args = updateManyCalls[0] as {
        data: { approvalStatus: string };
      };
      expect(args.data.approvalStatus).toBe("PENDING");
    });

    it("fails when only a DRAFT course covers the gap (DRAFT capacity not counted)", async () => {
      // No PENDING/APPROVED capacity; only the DRAFT being submitted (cap 20) < eligible 40
      peScopeFixture = [];
      coursesFixture = [makePe("pe2", "PE102", 2, 10, "DRAFT")];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];
      eligibleCount = 40;

      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow(/Cannot submit Program Elective courses/);
      expect(updateManyCalls.length).toBe(0);
    });

    it("error message includes eligible and configured capacity numbers", async () => {
      peScopeFixture = [makePe("pe1", "PE101", 4, 10, "APPROVED")];
      coursesFixture = [makePe("pe2", "PE102", 2, 10, "DRAFT")];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];
      eligibleCount = 100;

      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow("Eligible students: 100");
      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow("Configured capacity: 60");
    });

    it("fails on re-submit after a PENDING sibling is shrunk below the gap", async () => {
      // PE1 APPROVED cap 60 + PE2 PENDING cap 40; eligible 100. PE2 edited to cap 20 then re-submitted.
      peScopeFixture = [makePe("pe1", "PE101", 6, 10, "APPROVED")];
      coursesFixture = [makePe("pe2", "PE102", 2, 10, "DRAFT")];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];
      eligibleCount = 100;

      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow("Configured capacity: 80");
      expect(updateManyCalls.length).toBe(0);
    });

    it("delete regression: approving a basket after deletion reflects the reduced total", async () => {
      // PE1 APPROVED cap 40 after PE2 (cap 40) was deleted; eligible 80; submitting PE3 cap 30
      // configured = 40 (existing) + 30 (submitting) = 70 < 80 -> reject
      peScopeFixture = [makePe("pe1", "PE101", 4, 10, "APPROVED")];
      coursesFixture = [makePe("pe3", "PE103", 3, 10, "DRAFT")];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];
      eligibleCount = 80;

      await expect(
        CourseService.bulkSubmitForApproval("sem-1", "dep-1")
      ).rejects.toThrow("Configured capacity: 70");
      expect(updateManyCalls.length).toBe(0);
    });
  });

  describe("approveSemesterCourses aggregate PE capacity validation", () => {
    it("rejects approval when basket capacity < eligible students", async () => {
      peScopeFixture = [makePe("pe1", "PE101", 4, 10, "PENDING")];
      coursesFixture = [makePe("pe1", "PE101", 4, 10, "PENDING")];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];
      eligibleCount = 100;

      await expect(
        CourseService.approveSemesterCourses("sem-1", "dep-1")
      ).rejects.toThrow("Cannot approve Program Elective courses");
      expect(updateManyCalls.length).toBe(0);
    });

    it("approves when basket capacity meets eligible students", async () => {
      peScopeFixture = [makePe("pe1", "PE101", 4, 10, "PENDING")];
      coursesFixture = [makePe("pe1", "PE101", 4, 10, "PENDING")];
      batchesFixture = [
        {
          id: "b1",
          facultyAssignment: { id: "ebf-1", semester: 3, academicYear: "2026" },
        },
      ];
      eligibleCount = 40;

      const result = await CourseService.approveSemesterCourses(
        "sem-1",
        "dep-1"
      );

      expect(result.status).toBe("success");
      expect(updateManyCalls.length).toBe(1);
    });
  });

  describe("PeCapacityService per-course registration guard", () => {
    it("rejects capacity below the course's own registrations", async () => {
      registrationCountForCourse = 38;

      await expect(
        PeCapacityService.assertCourseCapacityAboveRegistrations({
          courseId: "course-pe",
          numberOfBatches: 2,
          studentsPerBatch: 10,
        })
      ).rejects.toThrow(
        "PE course capacity cannot be below its registrations: capacity 20 < registered 38."
      );
    });

    it("accepts capacity at or above the course's own registrations", async () => {
      registrationCountForCourse = 38;

      await expect(
        PeCapacityService.assertCourseCapacityAboveRegistrations({
          courseId: "course-pe",
          numberOfBatches: 4,
          studentsPerBatch: 10,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("PeCapacityService.getPeCapacitySummary", () => {
    it("sums only PENDING+APPROVED capacity and reports unclamped remaining seats", async () => {
      // configured: 60 (4x10 APPROVED) + 40 (4x10 PENDING) = 100; DRAFT course excluded
      peScopeFixture = [
        makePe("pe1", "PE101", 4, 10, "APPROVED"),
        makePe("pe2", "PE102", 4, 10, "PENDING"),
        makePe("pe3", "PE103", 10, 10, "DRAFT"),
      ];
      eligibleCount = 120;

      const summary = await PeCapacityService.getPeCapacitySummary({
        departmentId: "dep-1",
        semesterId: "sem-1",
        cycle: null,
      });

      expect(summary).toEqual({
        eligibleStudents: 120,
        configuredCapacity: 80,
        remainingSeats: 40,
      });
    });

    it("reports negative remainingSeats when over-configured", async () => {
      peScopeFixture = [makePe("pe1", "PE101", 4, 10, "APPROVED")];
      eligibleCount = 30;

      const summary = await PeCapacityService.getPeCapacitySummary({
        departmentId: "dep-1",
        semesterId: "sem-1",
        cycle: null,
      });

      expect(summary).toEqual({
        eligibleStudents: 30,
        configuredCapacity: 40,
        remainingSeats: -10,
      });
    });
  });

  describe("PeCapacityService.computePeFacultyMapping", () => {
    const fa = (semester: number, academicYear: string) => ({
      facultyAssignment: { id: "ebf-1", semester, academicYear },
    });

    it("marks fully mapped when every batch has a faculty for the semester/year", () => {
      const status = PeCapacityService.computePeFacultyMapping(
        [fa(3, "2026"), fa(3, "2026"), fa(3, "2026")],
        3,
        "2026"
      );

      expect(status).toEqual({
        expectedAssignments: 3,
        assignedAssignments: 3,
        isFullyMapped: true,
        isPartiallyMapped: false,
        isUnmapped: false,
      });
    });

    it("marks partially mapped when only some batches have faculty", () => {
      const status = PeCapacityService.computePeFacultyMapping(
        [fa(3, "2026"), fa(3, "2026"), { facultyAssignment: null }],
        3,
        "2026"
      );

      expect(status).toEqual({
        expectedAssignments: 3,
        assignedAssignments: 2,
        isFullyMapped: false,
        isPartiallyMapped: true,
        isUnmapped: false,
      });
    });

    it("marks unmapped when no batch has faculty", () => {
      const status = PeCapacityService.computePeFacultyMapping(
        [{ facultyAssignment: null }, { facultyAssignment: null }],
        3,
        "2026"
      );

      expect(status).toEqual({
        expectedAssignments: 2,
        assignedAssignments: 0,
        isFullyMapped: false,
        isPartiallyMapped: false,
        isUnmapped: true,
      });
    });

    it("marks unmapped when there are no batches", () => {
      const status = PeCapacityService.computePeFacultyMapping([], 3, "2026");

      expect(status).toEqual({
        expectedAssignments: 0,
        assignedAssignments: 0,
        isFullyMapped: false,
        isPartiallyMapped: false,
        isUnmapped: true,
      });
    });

    it("excludes faculty assigned to a different semester/year", () => {
      const status = PeCapacityService.computePeFacultyMapping(
        [fa(2, "2025"), fa(3, "2026")],
        3,
        "2026"
      );

      expect(status.assignedAssignments).toBe(1);
      expect(status.isPartiallyMapped).toBe(true);
      expect(status.isUnmapped).toBe(false);
    });

    it("ignores the semester/year when none is provided", () => {
      const status = PeCapacityService.computePeFacultyMapping(
        [fa(2, "2025"), fa(3, "2026")],
        null,
        undefined
      );

      expect(status.assignedAssignments).toBe(2);
      expect(status.isFullyMapped).toBe(true);
    });
  });

  describe("CourseRegistration OE registration contract (R1-R7)", () => {
    const makeStudent = (
      id: string,
      departmentName = "Computer Science"
    ): Record<string, unknown> => ({
      id,
      userId: `user-${id}`,
      departmentName,
      semesterId: "sem-1",
      academicTermId: "term-1",
      currentSemester: 3,
      programType: "PG",
      studentSections: [{ section: { cycle: "NONE" } }],
    });

    const makeOeBatch = (id: string, name: string, sortOrder: number) => ({
      id,
      name,
      sortOrder,
      facultyAssignment: {
        faculty: { shortName: "FF", user: { name: "FY Faculty" } },
      },
      _count: { electiveStudentAssignments: 0 },
    });

    const makeOeCourse = (overrides: Record<string, unknown> = {}) => ({
      id: "oe-course-1",
      code: "OE101",
      name: "OE 101",
      courseType: "OE",
      lectureCredits: 3,
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,
      totalCredits: 3,
      numberOfBatches: 1,
      studentsPerBatch: 1,
      departmentId: "dep-firstyear",
      departmentName: "Firstyear",
      openElectiveEligibility: "ALL",
      openElectiveDepartments: [],
      approvalStatus: "APPROVED",
      _count: { registrations: 0 },
      electiveBatches: [makeOeBatch("batch-1", "OE101 1", 1)],
      ...overrides,
    });

    const regRequest = (
      courseIds: string[],
      oeBatchIds?: Record<string, string>
    ) =>
      ({ courseIds, oeBatchIds }) as unknown as Parameters<
        typeof CourseRegistration.submitRegistration
      >[1];

    it("R1: capacity 1 - two students on the same OE batch, exactly one succeeds", async () => {
      useRegStore = true;
      windowOpenFixture = true;
      studentsFixture = {
        "user-stu1": makeStudent("stu1"),
        "user-stu2": makeStudent("stu2"),
      };
      regCoursesFixture = [makeOeCourse()];
      regStore = { registrations: [], assignments: [] };

      const results = await Promise.allSettled([
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
        CourseRegistration.submitRegistration(
          "user-stu2",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(
        /full/i
      );
      expect(regStore.assignments.length).toBe(1);
      expect(regStore.registrations.length).toBe(1);
    });

    it("R2: capacity 1 - two batches, A->batch1 B->batch2, both succeed (batch-level lock)", async () => {
      useRegStore = true;
      windowOpenFixture = true;
      studentsFixture = {
        "user-stu1": makeStudent("stu1"),
        "user-stu2": makeStudent("stu2"),
      };
      regCoursesFixture = [
        makeOeCourse({
          numberOfBatches: 2,
          electiveBatches: [
            makeOeBatch("batch-1", "OE101 1", 1),
            makeOeBatch("batch-2", "OE101 2", 2),
          ],
        }),
      ];
      regStore = { registrations: [], assignments: [] };

      const results = await Promise.allSettled([
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
        CourseRegistration.submitRegistration(
          "user-stu2",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-2" })
        ),
      ]);

      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
      expect(regStore.assignments.length).toBe(2);
      expect(regStore.registrations.length).toBe(2);
    });

    it("R3: duplicate self-race, exactly one registration and one assignment", async () => {
      useRegStore = true;
      windowOpenFixture = true;
      studentsFixture = { "user-stu1": makeStudent("stu1") };
      regCoursesFixture = [makeOeCourse({ studentsPerBatch: 5 })];
      regStore = { registrations: [], assignments: [] };

      const results = await Promise.allSettled([
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      expect(fulfilled.length).toBe(1);
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected.length).toBe(1);
      expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(
        /already completed/i
      );
      expect(
        regStore.registrations.filter((r) => r.studentId === "stu1").length
      ).toBe(1);
      expect(
        regStore.assignments.filter((a) => a.studentId === "stu1").length
      ).toBe(1);
    });

    it("R4: full batch rejects the third student with zero writes", async () => {
      useRegStore = true;
      windowOpenFixture = true;
      studentsFixture = {
        "user-stu1": makeStudent("stu1"),
        "user-stu2": makeStudent("stu2"),
      };
      regCoursesFixture = [makeOeCourse()];
      regStore = {
        registrations: [
          {
            studentId: "stu-exist",
            courseId: "oe-course-1",
            semesterId: "sem-1",
            academicTermId: "term-1",
          },
        ],
        assignments: [
          {
            studentId: "stu-exist",
            courseId: "oe-course-1",
            electiveBatchId: "batch-1",
          },
        ],
      };

      await expect(
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        )
      ).rejects.toThrow(/full/i);
      expect(regStore.assignments.length).toBe(1);
      expect(regStore.registrations.length).toBe(1);
    });

    it("R5: two OE courses selected is rejected (exactly one per bucket)", async () => {
      useRegStore = true;
      windowOpenFixture = true;
      studentsFixture = { "user-stu1": makeStudent("stu1") };
      regCoursesFixture = [
        makeOeCourse(),
        makeOeCourse({
          id: "oe-course-2",
          code: "OE102",
          name: "OE 102",
          electiveBatches: [makeOeBatch("batch-9", "OE102 1", 1)],
        }),
      ];
      regStore = { registrations: [], assignments: [] };

      await expect(
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1", "oe-course-2"])
        )
      ).rejects.toThrow(/exactly one Open Elective/i);
      expect(regStore.assignments.length).toBe(0);
    });

    it("R6a: CUSTOM OE excluding the student's department is hidden from curriculum", async () => {
      useRegStore = true;
      studentsFixture = {
        "user-stu1": makeStudent("stu1", "Mechanical"),
      };
      regCoursesFixture = [
        makeOeCourse({
          openElectiveEligibility: "CUSTOM",
          openElectiveDepartments: [
            { department: { name: "Computer Science" } },
          ],
        }),
      ];
      regStore = { registrations: [], assignments: [] };

      const curriculum =
        await CourseRegistration.getAvailableCurriculum("user-stu1");
      if (curriculum.status !== "success" || !curriculum.data) {
        throw new Error("expected success curriculum");
      }
      expect(curriculum.data.openElectives).toHaveLength(0);
    });

    it("R6b: a crafted submit payload for a hidden CUSTOM OE is rejected server-side", async () => {
      useRegStore = true;
      windowOpenFixture = true;
      studentsFixture = {
        "user-stu1": makeStudent("stu1", "Mechanical"),
      };
      regCoursesFixture = [
        makeOeCourse({
          openElectiveEligibility: "CUSTOM",
          openElectiveDepartments: [
            { department: { name: "Computer Science" } },
          ],
        }),
      ];
      regStore = { registrations: [], assignments: [] };

      await expect(
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        )
      ).rejects.toThrow(/do not belong to your approved curriculum/i);
      expect(regStore.assignments.length).toBe(0);
    });

    it("R8: a CUSTOM OE owned by another department is visible to an eligible student", async () => {
      // Cross-department visibility regression: Firstyear owns the OE (CUSTOM
      // listing Computer Science); a Computer Science student must see it even
      // though the course.departmentId differs from the student's department.
      useRegStore = true;
      studentsFixture = {
        "user-stu1": makeStudent("stu1", "Computer Science"),
      };
      regCoursesFixture = [
        makeOeCourse({
          openElectiveEligibility: "CUSTOM",
          openElectiveDepartments: [
            { department: { name: "Computer Science" } },
          ],
        }),
      ];
      regStore = { registrations: [], assignments: [] };

      const curriculum =
        await CourseRegistration.getAvailableCurriculum("user-stu1");
      if (curriculum.status !== "success" || !curriculum.data) {
        throw new Error("expected success curriculum");
      }
      expect(curriculum.data.openElectives).toHaveLength(1);
    });

    it("R7: capacity 2 - three students concurrent, exactly two succeed", async () => {
      useRegStore = true;
      windowOpenFixture = true;
      studentsFixture = {
        "user-stu1": makeStudent("stu1"),
        "user-stu2": makeStudent("stu2"),
        "user-stu3": makeStudent("stu3"),
      };
      regCoursesFixture = [makeOeCourse({ studentsPerBatch: 2 })];
      regStore = { registrations: [], assignments: [] };

      const results = await Promise.allSettled([
        CourseRegistration.submitRegistration(
          "user-stu1",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
        CourseRegistration.submitRegistration(
          "user-stu2",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
        CourseRegistration.submitRegistration(
          "user-stu3",
          regRequest(["oe-course-1"], { "oe-course-1": "batch-1" })
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      expect(fulfilled.length).toBe(2);
      expect(regStore.assignments.length).toBe(2);
    });
  });
});
