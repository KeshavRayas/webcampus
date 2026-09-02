import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ProjectMappingService } from "../project-mapping.service";

const courseFixture = {
  id: "c1",
  code: "PW101",
  name: "Final Year Project",
  projectGroupingScope: "DEPARTMENT_WIDE",
  numberOfBatches: 3,
  studentsPerBatch: 5,
  electiveMappingVersion: 2,
  semesterId: "sem8",
  semesterNumber: 8,
  cycle: "NONE",
  departmentName: "CSE",
  semester: { academicTerm: { year: "2026" } },
};

let deleteManyCalls: Array<Record<string, unknown>> = [];
let createManyCalls: Array<{ model: string; data: unknown[] }> = [];
let electiveBatchWhereCalls: unknown[] = [];

const dbMock = {
  department: {
    findFirst: async () => {
      return { id: "dept-cse", name: "CSE" };
    },
  },
  course: {
    findFirst: async ({ where }: { where: { courseType?: string } }) =>
      where?.courseType === "PW" ? { ...courseFixture } : null,
  },
  electiveBatch: {
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      electiveBatchWhereCalls.push(where);
      return [
        {
          id: "g1",
          name: "G-001",
          sectionId: null,
          sortOrder: 1,
          _count: { studentAssignments: 5 },
          section: null,
          facultyAssignment: {
            facultyId: "f1",
            faculty: { shortName: "Ravi", user: { name: "Dr. Ravi Kumar" } },
          },
        },
        {
          id: "g2",
          name: "G-002",
          sectionId: null,
          sortOrder: 2,
          _count: { studentAssignments: 4 },
          section: null,
          facultyAssignment: null,
        },
        {
          id: "g3",
          name: "G-003",
          sectionId: null,
          sortOrder: 3,
          _count: { studentAssignments: 0 },
          section: null,
          facultyAssignment: null,
        },
      ];
    },
    count: async ({ where }: { where?: { id?: { in?: string[] } } }) => {
      const ids = where?.id?.in ?? [];
      if (ids.length === 0) return 3;
      return ids.length;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      where?.courseId === "c1" && where?.id === "g1"
        ? {
            id: "g1",
            name: "G-001",
            sortOrder: 1,
            sectionId: null,
            section: null,
            facultyAssignment: {
              facultyId: "f1",
              faculty: {
                id: "f1",
                shortName: "Ravi",
                user: { name: "Dr. Ravi Kumar" },
              },
            },
          }
        : null,
  },
  electiveStudentAssignment: {
    findMany: async () => [
      {
        studentId: "s1",
        electiveBatchId: "g1",
        student: {
          id: "s1",
          usn: "1BM22CS001",
          user: { name: "Keshav" },
          studentSections: [{ section: { id: "sec-a", name: "A" } }],
        },
      },
      {
        studentId: "s2",
        electiveBatchId: "g1",
        student: {
          id: "s2",
          usn: "1BM22CS014",
          user: { name: "Rahul" },
          studentSections: [{ section: { id: "sec-a", name: "A" } }],
        },
      },
    ],
    deleteMany: async (args: Record<string, unknown>) => {
      deleteManyCalls.push({ model: "electiveStudentAssignment", ...args });
    },
    createMany: async (args: { data: unknown[] }) => {
      createManyCalls.push({
        model: "electiveStudentAssignment",
        data: args.data,
      });
    },
  },
  electiveBatchFaculty: {
    deleteMany: async (args: Record<string, unknown>) => {
      deleteManyCalls.push({ model: "electiveBatchFaculty", ...args });
    },
    createMany: async (args: { data: unknown[] }) => {
      createManyCalls.push({ model: "electiveBatchFaculty", data: args.data });
    },
    findMany: async () => {
      return [];
    },
  },
  faculty: {
    count: async ({
      where,
    }: {
      where?: { id?: string | { in?: string[] } };
    }) => {
      const known = new Set(["f1", "f2"]);
      const id = where?.id;
      if (typeof id === "string") return known.has(id) ? 1 : 0;
      const ids = id?.in ?? [];
      return ids.filter((x) => known.has(x)).length;
    },
    findMany: async ({
      where,
    }: {
      where?: { id?: string | { in?: string[] } };
    }) => {
      const known = new Map([
        ["f1", "dept-cse"],
        ["f2", "dept-cse"],
      ]);
      const id = where?.id;
      if (typeof id === "string") {
        return known.has(id) ? [{ id, departmentId: known.get(id) }] : [];
      }
      const ids = id?.in ?? [];
      return ids
        .filter((x) => known.has(x))
        .map((x) => ({ id: x, departmentId: known.get(x) }));
    },
  },
  attendance: { findFirst: async () => null },
  mark: { findFirst: async () => null },
  classSession: { findFirst: async () => null },
  adminEditLog: { createMany: async () => ({ count: 1 }) },
  courseRegistration: {
    findMany: async () => [
      {
        studentId: "s1",
        student: {
          id: "s1",
          usn: "1BM22CS001",
          departmentName: "CSE",
          semesterId: "sem8",
          user: { name: "Keshav" },
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
          user: { name: "Rahul" },
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
    ],
  },
  $transaction: async (
    callback: (tx: Record<string, unknown>) => Promise<unknown>
  ) => {
    const tx = {
      course: {
        updateMany: async () => ({ count: 1 }),
        findUnique: async () => ({ electiveMappingVersion: 2 }),
        update: async () => ({}),
      },
      electiveStudentAssignment: {
        deleteMany: dbMock.electiveStudentAssignment.deleteMany,
        createMany: dbMock.electiveStudentAssignment.createMany,
      },
      electiveBatchFaculty: {
        deleteMany: dbMock.electiveBatchFaculty.deleteMany,
        createMany: dbMock.electiveBatchFaculty.createMany,
      },
    };
    return callback(tx);
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
  },
  CourseApprovalStatus: {
    APPROVED: "APPROVED",
    PENDING: "PENDING",
    DRAFT: "DRAFT",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
  Designation: {},
  Cycle: {},
  PrismaClient: class PrismaClient {},
}));

mock.module("@webcampus/common/logger", () => ({
  logger: { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} },
}));

describe("ProjectMappingService.getGroups", () => {
  beforeEach(() => {
    electiveBatchWhereCalls = [];
  });

  test("returns paginated groups with summary counters", async () => {
    const result = (await ProjectMappingService.getGroups(
      "c1",
      { page: 1, limit: 25 },
      "user-dept",
      { requesterRole: "department" }
    )) as {
      status: string;
      data: { items: unknown[]; pagination: unknown; summary: unknown };
    };

    expect(result.status).toBe("success");
    expect(result.data.items).toHaveLength(3);
    expect(result.data.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 3,
      pages: 1,
    });
    expect(result.data.summary).toEqual({
      total: 3,
      assigned: 3,
      unassigned: 0,
    });
  });

  test("builds UNASSIGNED status filter", async () => {
    await ProjectMappingService.getGroups(
      "c1",
      { page: 1, limit: 25, status: "UNASSIGNED" },
      "user-dept",
      { requesterRole: "department" }
    );
    const where = electiveBatchWhereCalls[0] as { status?: unknown };
    expect(where).toHaveProperty("facultyAssignment", { is: null });
  });

  test("builds ASSIGNED status filter", async () => {
    await ProjectMappingService.getGroups(
      "c1",
      { page: 1, limit: 25, status: "ASSIGNED" },
      "user-dept",
      { requesterRole: "department" }
    );
    const where = electiveBatchWhereCalls[0] as { facultyAssignment?: unknown };
    expect(where).toHaveProperty("facultyAssignment", { isNot: null });
  });

  test("clamps page/limit to sane bounds", async () => {
    const result = (await ProjectMappingService.getGroups(
      "c1",
      { page: 0, limit: 999 },
      "user-dept",
      { requesterRole: "department" }
    )) as { data: { pagination: { page: number; limit: number } } };
    expect(result.data.pagination.page).toBe(1);
    expect(result.data.pagination.limit).toBe(100);
  });

  test("throws PW course not found for non-PW course", async () => {
    const dbCourseFindFirst = dbMock.course.findFirst;
    dbMock.course.findFirst = async ({
      where,
    }: {
      where: { courseType?: string };
    }) => (where?.courseType === "PW" ? null : null);
    await expect(
      ProjectMappingService.getGroups(
        "c-x",
        { page: 1, limit: 25 },
        "user-dept",
        {
          requesterRole: "department",
        }
      )
    ).rejects.toThrow("PW course not found");
    dbMock.course.findFirst = dbCourseFindFirst;
  });
});

describe("ProjectMappingService.getGroupDetail", () => {
  test("returns group with members", async () => {
    const result = (await ProjectMappingService.getGroupDetail(
      "c1",
      "g1",
      "user-dept",
      { requesterRole: "department" }
    )) as { status: string; data: { group: unknown; members: unknown[] } };
    expect(result.status).toBe("success");
    expect(result.data.group).toHaveProperty("name", "G-001");
    expect(result.data.members).toHaveLength(2);
  });

  test("throws when group not found", async () => {
    await expect(
      ProjectMappingService.getGroupDetail("c1", "g-missing", "user-dept", {
        requesterRole: "department",
      })
    ).rejects.toThrow("Project group not found");
  });
});

describe("ProjectMappingService.saveAssignments", () => {
  beforeEach(() => {
    deleteManyCalls = [];
    createManyCalls = [];
  });

  const okPayload = {
    courseId: "c1",
    electiveMappingVersion: 2,
    assignments: [
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g2" },
    ],
  };

  test("rejects when assignment count does not match registrations", async () => {
    await expect(
      ProjectMappingService.saveAssignments(
        {
          ...okPayload,
          assignments: [{ studentId: "s1", electiveBatchId: "g1" }],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "Every registered student must be assigned to a group before saving"
    );
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("rejects a student not registered for the PW course", async () => {
    await expect(
      ProjectMappingService.saveAssignments(
        {
          ...okPayload,
          assignments: [
            { studentId: "s1", electiveBatchId: "g1" },
            { studentId: "s3", electiveBatchId: "g2" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "Assignment includes a student not registered for this PW course"
    );
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("rejects an invalid project group", async () => {
    await expect(
      ProjectMappingService.saveAssignments(
        {
          ...okPayload,
          assignments: [
            { studentId: "s1", electiveBatchId: "g-bad" },
            { studentId: "s2", electiveBatchId: "g2" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow("Assignment includes an invalid project group");
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("rejects duplicate students in payload", async () => {
    await expect(
      ProjectMappingService.saveAssignments(
        {
          ...okPayload,
          assignments: [
            { studentId: "s1", electiveBatchId: "g1" },
            { studentId: "s1", electiveBatchId: "g2" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow("Duplicate student in project mapping payload");
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("within-section scope rejects cross-section placement", async () => {
    const dbCourseFindFirst = dbMock.course.findFirst;
    const dbBatchFindMany = dbMock.electiveBatch.findMany;
    dbMock.course.findFirst = async ({
      where,
    }: {
      where: { courseType?: string };
    }) =>
      where?.courseType === "PW"
        ? { ...courseFixture, projectGroupingScope: "WITHIN_SECTION" }
        : null;
    dbMock.electiveBatch.findMany = (async () => [
      {
        id: "g-sec-a",
        sectionId: "sec-a",
        name: "G-001",
        sortOrder: 1,
        _count: { studentAssignments: 0 },
        section: null,
        facultyAssignment: null,
      },
      {
        id: "g-sec-b",
        sectionId: "sec-b",
        name: "G-002",
        sortOrder: 2,
        _count: { studentAssignments: 0 },
        section: null,
        facultyAssignment: null,
      },
    ]) as unknown as typeof dbMock.electiveBatch.findMany;

    await expect(
      ProjectMappingService.saveAssignments(
        {
          ...okPayload,
          assignments: [
            { studentId: "s1", electiveBatchId: "g-sec-b" },
            { studentId: "s2", electiveBatchId: "g-sec-a" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "Student 1BM22CS001 cannot be placed in a group outside their section"
    );
    expect(deleteManyCalls).toHaveLength(0);

    dbMock.course.findFirst = dbCourseFindFirst;
    dbMock.electiveBatch.findMany = dbBatchFindMany;
  });

  test("rejects when group exceeds students-per-group capacity", async () => {
    const dbCourseFindFirst = dbMock.course.findFirst;
    dbMock.course.findFirst = async ({
      where,
    }: {
      where: { courseType?: string };
    }) =>
      where?.courseType === "PW"
        ? { ...courseFixture, studentsPerBatch: 1 }
        : null;

    await expect(
      ProjectMappingService.saveAssignments(
        {
          ...okPayload,
          assignments: [
            { studentId: "s1", electiveBatchId: "g1" },
            { studentId: "s2", electiveBatchId: "g1" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow("exceeds the students-per-group limit of 1");
    expect(deleteManyCalls).toHaveLength(0);

    dbMock.course.findFirst = dbCourseFindFirst;
  });

  test("saves atomically and returns new version", async () => {
    const result = (await ProjectMappingService.saveAssignments(
      okPayload,
      "user-dept",
      { requesterRole: "department" }
    )) as { status: string; data: { electiveMappingVersion: number } };

    expect(result.status).toBe("success");
    expect(result.data.electiveMappingVersion).toBe(3);
    expect(deleteManyCalls).toHaveLength(1);
    expect(deleteManyCalls[0]!).toMatchObject({
      model: "electiveStudentAssignment",
      where: { courseId: "c1" },
    });
    expect(createManyCalls).toHaveLength(1);
    expect(createManyCalls[0]!.data as unknown[]).toHaveLength(2);
  });
});

describe("ProjectMappingService.saveFaculty", () => {
  beforeEach(() => {
    deleteManyCalls = [];
    createManyCalls = [];
  });

  test("rejects a batch that does not belong to the course", async () => {
    const dbBatchCount = dbMock.electiveBatch.count;
    dbMock.electiveBatch.count = async () => 1;
    await expect(
      ProjectMappingService.saveFaculty(
        {
          courseId: "c1",
          assignments: [
            { electiveBatchId: "g1", facultyId: "f1" },
            { electiveBatchId: "g-bad", facultyId: "f1" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "One or more project groups do not belong to this course"
    );
    expect(deleteManyCalls).toHaveLength(0);
    dbMock.electiveBatch.count = dbBatchCount;
  });

  test("rejects invalid faculty", async () => {
    await expect(
      ProjectMappingService.saveFaculty(
        {
          courseId: "c1",
          assignments: [{ electiveBatchId: "g1", facultyId: "f-nope" }],
        },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow("One or more faculty records are invalid");
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("wipes and recreates faculty mappings for the course", async () => {
    const result = (await ProjectMappingService.saveFaculty(
      {
        courseId: "c1",
        assignments: [
          { electiveBatchId: "g1", facultyId: "f1" },
          { electiveBatchId: "g2", facultyId: "f2" },
          { electiveBatchId: "g3", facultyId: null },
        ],
      },
      "user-dept",
      { requesterRole: "department" }
    )) as { status: string };

    expect(result.status).toBe("success");
    expect(deleteManyCalls).toHaveLength(1);
    expect(deleteManyCalls[0]!).toMatchObject({
      model: "electiveBatchFaculty",
      where: { courseId: "c1", semester: 8, academicYear: "2026" },
    });
    expect(createManyCalls).toHaveLength(1);
    const rows = createManyCalls[0]!.data as Array<{
      electiveBatchId: string;
      facultyId: string;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows).not.toContainEqual(
      expect.objectContaining({ electiveBatchId: "g3" })
    );
  });
});

describe("ProjectMappingService.bulkAssign", () => {
  beforeEach(() => {
    deleteManyCalls = [];
    createManyCalls = [];
  });

  test("assigns multiple groups to one faculty", async () => {
    const result = (await ProjectMappingService.bulkAssign(
      { courseId: "c1", electiveBatchIds: ["g1", "g2", "g3"], facultyId: "f1" },
      "user-dept",
      { requesterRole: "department" }
    )) as { status: string; message: string };

    expect(result.status).toBe("success");
    expect(result.message).toBe("3 project groups assigned to faculty");
    expect(deleteManyCalls).toHaveLength(1);
    const created = createManyCalls[0]!.data as Array<{
      electiveBatchId: string;
      facultyId: string;
    }>;
    expect(created).toHaveLength(3);
    expect(created.every((r) => r.facultyId === "f1")).toBe(true);
  });

  test("rejects invalid faculty", async () => {
    await expect(
      ProjectMappingService.bulkAssign(
        { courseId: "c1", electiveBatchIds: ["g1"], facultyId: "f-nope" },
        "user-dept",
        { requesterRole: "department" }
      )
    ).rejects.toThrow("Faculty record is invalid");
    expect(deleteManyCalls).toHaveLength(0);
  });
});

describe("ProjectMappingService.saveFullMapping", () => {
  beforeEach(() => {
    deleteManyCalls = [];
    createManyCalls = [];
  });

  const fullPayload = {
    courseId: "c1",
    electiveMappingVersion: 2,
    assignments: [
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g2" },
    ],
    faculty: [
      { electiveBatchId: "g1", facultyId: "f1" },
      { electiveBatchId: "g2", facultyId: "f2" },
      { electiveBatchId: "g3", facultyId: "f1" },
    ],
  };

  test("saves complete state atomically with one version bump and one audit", async () => {
    const result = (await ProjectMappingService.saveFullMapping(
      fullPayload,
      "user-dept",
      { requesterRole: "department" }
    )) as { status: string; data: { electiveMappingVersion: number } };

    expect(result.status).toBe("success");
    expect(result.data.electiveMappingVersion).toBe(3);

    expect(deleteManyCalls).toHaveLength(2);
    expect(deleteManyCalls[0]!).toMatchObject({
      model: "electiveStudentAssignment",
      where: { courseId: "c1" },
    });
    expect(deleteManyCalls[1]!).toMatchObject({
      model: "electiveBatchFaculty",
      where: { courseId: "c1", semester: 8, academicYear: "2026" },
    });

    expect(createManyCalls).toHaveLength(2);
    const studentRows = createManyCalls[0]!.data as Array<{
      studentId: string;
      electiveBatchId: string;
    }>;
    expect(studentRows).toHaveLength(2);
    const facultyRows = createManyCalls[1]!.data as Array<{
      electiveBatchId: string;
      facultyId: string;
    }>;
    expect(facultyRows).toHaveLength(3);
  });

  test("rejects payload without faculty assignments", async () => {
    const payload = { ...fullPayload, faculty: undefined };
    await expect(
      ProjectMappingService.saveFullMapping(payload as never, "user-dept", {
        requesterRole: "department",
      })
    ).rejects.toThrow("Faculty assignments are required for unified save");
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("rejects when a group is missing faculty (complete-state)", async () => {
    const payload = {
      ...fullPayload,
      faculty: [
        { electiveBatchId: "g1", facultyId: "f1" },
        { electiveBatchId: "g2", facultyId: "f2" },
      ],
    };
    await expect(
      ProjectMappingService.saveFullMapping(payload, "user-dept", {
        requesterRole: "department",
      })
    ).rejects.toThrow(
      "Every active project group must have exactly one faculty assigned"
    );
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("rejects a null-faculty group (complete-state)", async () => {
    const payload = {
      ...fullPayload,
      faculty: [
        { electiveBatchId: "g1", facultyId: "f1" },
        { electiveBatchId: "g2", facultyId: "f2" },
        { electiveBatchId: "g3", facultyId: null },
      ],
    };
    await expect(
      ProjectMappingService.saveFullMapping(payload, "user-dept", {
        requesterRole: "department",
      })
    ).rejects.toThrow(
      "Every active project group must have exactly one faculty assigned"
    );
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("rejects duplicate project group in faculty mapping", async () => {
    const payload = {
      ...fullPayload,
      faculty: [
        { electiveBatchId: "g1", facultyId: "f1" },
        { electiveBatchId: "g2", facultyId: "f2" },
        { electiveBatchId: "g3", facultyId: "f1" },
        { electiveBatchId: "g1", facultyId: "f2" },
      ],
    };
    await expect(
      ProjectMappingService.saveFullMapping(payload, "user-dept", {
        requesterRole: "department",
      })
    ).rejects.toThrow("Duplicate project group in faculty mapping payload");
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("allows faculty from another department", async () => {
    const originalFindMany = dbMock.faculty.findMany;
    dbMock.faculty.findMany = async () => [
      { id: "f1", departmentId: "dept-cse" },
      { id: "f2", departmentId: "dept-other" },
    ];
    try {
      await expect(
        ProjectMappingService.saveFullMapping(fullPayload, "user-dept", {
          requesterRole: "department",
        })
      ).resolves.toBeDefined();
    } finally {
      dbMock.faculty.findMany = originalFindMany;
    }
    expect(deleteManyCalls).toHaveLength(2);
  });

  test("no-op skip is order-insensitive and produces no version bump or audit", async () => {
    const originalStudentFind = dbMock.electiveStudentAssignment.findMany;
    const originalFacultyFind = dbMock.electiveBatchFaculty.findMany;
    dbMock.electiveStudentAssignment.findMany = (async () => [
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g2" },
    ]) as unknown as typeof dbMock.electiveStudentAssignment.findMany;
    dbMock.electiveBatchFaculty.findMany = (async () => [
      { electiveBatchId: "g1", facultyId: "f1" },
      { electiveBatchId: "g2", facultyId: "f2" },
      { electiveBatchId: "g3", facultyId: "f1" },
    ]) as unknown as typeof dbMock.electiveBatchFaculty.findMany;
    try {
      const result = (await ProjectMappingService.saveFullMapping(
        {
          courseId: "c1",
          electiveMappingVersion: 2,
          assignments: [
            { studentId: "s2", electiveBatchId: "g2" },
            { studentId: "s1", electiveBatchId: "g1" },
          ],
          faculty: [
            { electiveBatchId: "g3", facultyId: "f1" },
            { electiveBatchId: "g1", facultyId: "f1" },
            { electiveBatchId: "g2", facultyId: "f2" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )) as {
        status: string;
        message: string;
        data: { electiveMappingVersion: number };
      };

      expect(result.message).toBe("Project mapping is already up to date");
      expect(result.data.electiveMappingVersion).toBe(2);
      expect(deleteManyCalls).toHaveLength(0);
      expect(createManyCalls).toHaveLength(0);
    } finally {
      dbMock.electiveStudentAssignment.findMany = originalStudentFind;
      dbMock.electiveBatchFaculty.findMany = originalFacultyFind;
    }
  });

  test("a single faculty change bumps version exactly once and writes an audit row", async () => {
    const originalStudentFind = dbMock.electiveStudentAssignment.findMany;
    const originalFacultyFind = dbMock.electiveBatchFaculty.findMany;
    dbMock.electiveStudentAssignment.findMany = (async () => [
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g2" },
    ]) as unknown as typeof dbMock.electiveStudentAssignment.findMany;
    dbMock.electiveBatchFaculty.findMany = (async () => [
      { electiveBatchId: "g1", facultyId: "f1" },
      { electiveBatchId: "g2", facultyId: "f2" },
      { electiveBatchId: "g3", facultyId: "f1" },
    ]) as unknown as typeof dbMock.electiveBatchFaculty.findMany;
    try {
      const result = (await ProjectMappingService.saveFullMapping(
        {
          ...fullPayload,
          faculty: [
            { electiveBatchId: "g1", facultyId: "f1" },
            { electiveBatchId: "g2", facultyId: "f2" },
            { electiveBatchId: "g3", facultyId: "f2" },
          ],
        },
        "user-dept",
        { requesterRole: "department" }
      )) as { status: string; data: { electiveMappingVersion: number } };

      expect(result.data.electiveMappingVersion).toBe(3);
      expect(deleteManyCalls).toHaveLength(2);
      expect(createManyCalls).toHaveLength(2);
    } finally {
      dbMock.electiveStudentAssignment.findMany = originalStudentFind;
      dbMock.electiveBatchFaculty.findMany = originalFacultyFind;
    }
  });

  test("stale version is rejected with zero database writes", async () => {
    const originalTransaction = dbMock.$transaction;
    dbMock.$transaction = async (
      callback: (tx: Record<string, unknown>) => Promise<unknown>
    ) => {
      const tx = {
        course: {
          updateMany: async () => ({ count: 0 }),
          findUnique: async () => ({ electiveMappingVersion: 3 }),
          update: async () => ({}),
        },
        electiveStudentAssignment: {
          deleteMany: dbMock.electiveStudentAssignment.deleteMany,
          createMany: dbMock.electiveStudentAssignment.createMany,
        },
        electiveBatchFaculty: {
          deleteMany: dbMock.electiveBatchFaculty.deleteMany,
          createMany: dbMock.electiveBatchFaculty.createMany,
        },
      };
      return callback(tx);
    };
    try {
      await expect(
        ProjectMappingService.saveFullMapping(fullPayload, "user-dept", {
          requesterRole: "department",
        })
      ).rejects.toThrow(
        "Course mapping has been modified by another user. Please refresh."
      );
    } finally {
      dbMock.$transaction = originalTransaction;
    }
    expect(deleteManyCalls).toHaveLength(0);
    expect(createManyCalls).toHaveLength(0);
  });

  test("blocks student moves after attendance or marks exist", async () => {
    const originalAttendance = dbMock.attendance.findFirst;
    dbMock.attendance.findFirst = (async () => ({
      id: "att-1",
    })) as unknown as typeof dbMock.attendance.findFirst;
    try {
      await expect(
        ProjectMappingService.saveFullMapping(fullPayload, "user-dept", {
          requesterRole: "department",
        })
      ).rejects.toThrow(
        "Cannot move already-mapped students after attendance or marks exist"
      );
    } finally {
      dbMock.attendance.findFirst = originalAttendance;
    }
    expect(deleteManyCalls).toHaveLength(0);
  });

  test("blocks faculty reassignment after attendance or marks exist", async () => {
    const originalAttendance = dbMock.attendance.findFirst;
    const originalStudentFind = dbMock.electiveStudentAssignment.findMany;
    dbMock.attendance.findFirst = (async () => ({
      id: "att-1",
    })) as unknown as typeof dbMock.attendance.findFirst;
    dbMock.electiveStudentAssignment.findMany = (async () => [
      { studentId: "s1", electiveBatchId: "g1" },
      { studentId: "s2", electiveBatchId: "g2" },
    ]) as unknown as typeof dbMock.electiveStudentAssignment.findMany;
    try {
      const payload = {
        courseId: "c1",
        electiveMappingVersion: 2,
        assignments: [
          { studentId: "s1", electiveBatchId: "g1" },
          { studentId: "s2", electiveBatchId: "g2" },
        ],
        faculty: [
          { electiveBatchId: "g1", facultyId: "f1" },
          { electiveBatchId: "g2", facultyId: "f2" },
          { electiveBatchId: "g3", facultyId: "f1" },
        ],
      };
      await expect(
        ProjectMappingService.saveFullMapping(payload, "user-dept", {
          requesterRole: "department",
        })
      ).rejects.toThrow(
        "Faculty assignments cannot be modified after attendance or marks have been recorded for this course"
      );
    } finally {
      dbMock.attendance.findFirst = originalAttendance;
      dbMock.electiveStudentAssignment.findMany = originalStudentFind;
    }
    expect(deleteManyCalls).toHaveLength(0);
  });
});
