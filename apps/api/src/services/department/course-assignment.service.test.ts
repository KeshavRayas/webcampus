/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

let explicitDepartment: {
  id: string;
  name: string;
  type: string;
  abbreviation: string;
} | null;
let sessionDepartment: {
  id: string;
  name: string;
  type: string;
  abbreviation: string;
} | null;
let courseFindManyCalls = 0;
let courseRecord: Record<string, unknown> | null = null;
let electiveBatchRecords: {
  id: string;
  name?: string;
  sortOrder?: number;
  section?: { id: string; name: string } | null;
  facultyAssignment?: {
    id: string;
    facultyId: string;
    semester: number;
    academicYear: string;
    faculty: { shortName?: string; user?: { name?: string } | null } | null;
  } | null;
}[] = [];
let facultyRecords: Record<string, unknown>[] = [];
let hasAttendanceOrMarks = false;
let courseAssignmentCreateCount = 0;
let electiveBatchFacultyCreateCount = 0;
let electiveBatchFacultyDeleteCount = 0;

interface TestDb {
  department: {
    findUnique: () => Promise<typeof sessionDepartment>;
    findFirst: () => Promise<typeof sessionDepartment>;
  };
  course: {
    findMany: () => Promise<never[]>;
    findFirst: () => Promise<Record<string, unknown> | null>;
  };
  semester: {
    findUnique: () => Promise<{ semesterNumber: number }>;
  };
  electiveBatch: {
    findMany: () => Promise<typeof electiveBatchRecords>;
  };
  faculty: {
    findMany: (args?: {
      where?: { id?: { in?: string[] }; departmentId?: string };
      include?: { user?: object };
      orderBy?: unknown;
    }) => Promise<Record<string, unknown>[]>;
  };
  attendance: { findFirst: () => Promise<{ id: string } | null> };
  mark: { findFirst: () => Promise<{ id: string } | null> };
  classSession: { findFirst: () => Promise<{ id: string } | null> };
  courseAssignment: {
    deleteMany: () => Promise<{ count: number }>;
    createMany: () => Promise<{ count: number }>;
  };
  electiveBatchFaculty: {
    deleteMany: () => Promise<{ count: number }>;
    create: () => Promise<{ id: string }>;
  };
  $transaction: (fn: (tx: TestDb) => Promise<unknown>) => Promise<unknown>;
}

const dbMock: TestDb = {
  department: {
    findUnique: async () => explicitDepartment,
    findFirst: async () => sessionDepartment,
  },
  course: {
    findMany: async () => {
      courseFindManyCalls += 1;
      return [];
    },
    findFirst: async () => courseRecord,
  },
  semester: {
    findUnique: async () => ({ semesterNumber: 3 }),
  },
  electiveBatch: {
    findMany: async () => electiveBatchRecords,
  },
  faculty: {
    findMany: async (args?: {
      where?: { id?: { in?: string[] }; departmentId?: string };
      include?: { user?: object };
      orderBy?: unknown;
    }) => {
      let records = facultyRecords;
      if (args?.where?.id?.in) {
        records = records.filter((r) =>
          (args.where!.id!.in as string[]).includes(String(r.id))
        );
      }
      if (args?.where?.departmentId) {
        records = records.filter(
          (r) => r.departmentId === args!.where!.departmentId
        );
      }
      return records;
    },
  },
  attendance: {
    findFirst: async () => (hasAttendanceOrMarks ? { id: "att-1" } : null),
  },
  mark: {
    findFirst: async () => (hasAttendanceOrMarks ? { id: "mark-1" } : null),
  },
  classSession: {
    findFirst: async () => (hasAttendanceOrMarks ? { id: "sess-1" } : null),
  },
  courseAssignment: {
    deleteMany: async () => ({ count: 0 }),
    createMany: async () => {
      courseAssignmentCreateCount += 1;
      return { count: 0 };
    },
  },
  electiveBatchFaculty: {
    deleteMany: async () => {
      electiveBatchFacultyDeleteCount += 1;
      return { count: 0 };
    },
    create: async () => {
      electiveBatchFacultyCreateCount += 1;
      return { id: "created" };
    },
  },
  $transaction: async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
    fn(dbMock),
};

class PrismaClientKnownRequestError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: { PrismaClientKnownRequestError },
  CourseApprovalStatus: {
    DRAFT: "DRAFT",
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
  },
}));

mock.module(
  "@webcampus/api/src/services/shared/department-context-resolver.service",
  () => ({
    DepartmentContextResolver: {
      resolve: async (input: { departmentId?: string }) => ({
        departmentId: input.departmentId ?? "dep-explicit",
        departmentName: "Explicit Department",
      }),
    },
  })
);

describe("CourseAssignmentService department ownership guard", () => {
  beforeEach(() => {
    explicitDepartment = {
      id: "dep-explicit",
      name: "Explicit Department",
      type: "ENGINEERING",
      abbreviation: "ED",
    };
    sessionDepartment = {
      id: "dep-session",
      name: "Session Department",
      type: "ENGINEERING",
      abbreviation: "SD",
    };
    courseFindManyCalls = 0;
    courseRecord = null;
    electiveBatchRecords = [];
    facultyRecords = [];
    hasAttendanceOrMarks = false;
    courseAssignmentCreateCount = 0;
    electiveBatchFacultyCreateCount = 0;
    electiveBatchFacultyDeleteCount = 0;
  });

  it("rejects non-admin explicit department override when it mismatches session department", async () => {
    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.getMappingStatus(
        "sem-1",
        "2025-26",
        "user-1",
        undefined,
        {
          departmentId: "dep-explicit",
          requesterRole: "department",
        }
      )
    ).rejects.toThrow("Forbidden: department scope mismatch");

    expect(courseFindManyCalls).toBe(0);
  });
});

describe("CourseAssignmentService getMappingByCourse (batch-managed)", () => {
  it("annotates WITHIN_SECTION PW groups with their section", async () => {
    sessionDepartment = {
      id: "dep-session",
      name: "Session Department",
      type: "ENGINEERING",
      abbreviation: "SD",
    };
    courseRecord = {
      id: "course-1",
      courseType: "PW",
      projectGroupingScope: "WITHIN_SECTION",
    };
    electiveBatchRecords = [
      {
        id: "eb-1",
        name: "G-001",
        sortOrder: 0,
        section: { id: "sec-a", name: "A" },
        facultyAssignment: null,
      },
      {
        id: "eb-2",
        name: "G-002",
        sortOrder: 1,
        section: { id: "sec-b", name: "B" },
        facultyAssignment: null,
      },
    ];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    const res = await CourseAssignmentService.getMappingByCourse(
      "course-1",
      "sem-1",
      "2025-26",
      "user-1",
      { requesterRole: "department" }
    );

    const data = (res as { data: unknown }).data as {
      electiveBatchName: string;
      sectionName: string | null;
      proposedFacultyId?: string | null;
    }[];
    expect(data).toHaveLength(2);
    expect(data[0]!).toMatchObject({
      electiveBatchName: "G-001",
      sectionName: "A",
    });
    expect(data[1]!).toMatchObject({
      electiveBatchName: "G-002",
      sectionName: "B",
    });
    expect(data[0]!.proposedFacultyId).toBeUndefined();
  });

  it("proposes a balanced faculty distribution for DEPARTMENT_WIDE PW groups", async () => {
    sessionDepartment = {
      id: "dep-session",
      name: "Session Department",
      type: "ENGINEERING",
      abbreviation: "SD",
    };
    courseRecord = {
      id: "course-1",
      courseType: "PW",
      projectGroupingScope: "DEPARTMENT_WIDE",
    };
    electiveBatchRecords = [
      {
        id: "eb-1",
        name: "G-001",
        sortOrder: 0,
        section: null,
        facultyAssignment: null,
      },
      {
        id: "eb-2",
        name: "G-002",
        sortOrder: 1,
        section: null,
        facultyAssignment: null,
      },
    ];
    facultyRecords = [
      { id: "f-1", departmentId: "dep-session", user: { name: "Ambuja" } },
      { id: "f-2", departmentId: "dep-session", user: { name: "Ravi" } },
    ];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    const res = await CourseAssignmentService.getMappingByCourse(
      "course-1",
      "sem-1",
      "2025-26",
      "user-1",
      { requesterRole: "department" }
    );

    const data = (res as { data: unknown }).data as {
      electiveBatchId: string;
      proposedFacultyId: string | null;
    }[];
    expect(data).toHaveLength(2);
    expect(data[0]!.proposedFacultyId).toBe("f-1");
    expect(data[1]!.proposedFacultyId).toBe("f-2");
  });

  it("keeps PE/OE rows without a section or proposal", async () => {
    sessionDepartment = {
      id: "dep-session",
      name: "Session Department",
      type: "ENGINEERING",
      abbreviation: "SD",
    };
    courseRecord = { id: "course-1", courseType: "PE" };
    electiveBatchRecords = [
      {
        id: "eb-1",
        name: "PE 1",
        sortOrder: 0,
        section: null,
        facultyAssignment: null,
      },
    ];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    const res = await CourseAssignmentService.getMappingByCourse(
      "course-1",
      "sem-1",
      "2025-26",
      "user-1",
      { requesterRole: "department" }
    );

    const data = (res as { data: unknown }).data as {
      electiveBatchName: string;
      sectionName: string | null;
      proposedFacultyId?: string | null;
    }[];
    expect(data[0]!).toMatchObject({
      electiveBatchName: "PE 1",
      sectionName: null,
    });
    expect(data[0]!.proposedFacultyId).toBeUndefined();
  });
});

describe("CourseAssignmentService upsertMapping (batch-managed)", () => {
  beforeEach(() => {
    sessionDepartment = {
      id: "dep-session",
      name: "Session Department",
      type: "ENGINEERING",
      abbreviation: "SD",
    };
    courseRecord = {
      id: "course-1",
      courseType: "PW",
      approvalStatus: "DRAFT",
      projectGroupingScope: "WITHIN_SECTION",
    };
    electiveBatchRecords = [{ id: "eb-1" }, { id: "eb-2" }];
    facultyRecords = [
      { id: "f-1", departmentId: "dep-session" },
      { id: "f-2", departmentId: "dep-session" },
    ];
    hasAttendanceOrMarks = false;
    courseAssignmentCreateCount = 0;
    electiveBatchFacultyCreateCount = 0;
    electiveBatchFacultyDeleteCount = 0;
  });

  it("rejects faculty ids that do not exist", async () => {
    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.upsertMapping(
        {
          courseId: "course-1",
          semesterId: "sem-1",
          academicYear: "2025-26",
          electiveBatchMappings: [
            { electiveBatchId: "eb-1", facultyId: "f-1" },
            { electiveBatchId: "eb-2", facultyId: "f-other" },
          ],
        },
        "user-1",
        { requesterRole: "department" }
      )
    ).rejects.toThrow("One or more faculty records are invalid");

    expect(electiveBatchFacultyDeleteCount).toBe(0);
  });

  it("allows cross-department faculty for PW batch mappings", async () => {
    facultyRecords = [
      { id: "f-1", departmentId: "dep-session" },
      { id: "f-2", departmentId: "dep-other" },
    ];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.upsertMapping(
        {
          courseId: "course-1",
          semesterId: "sem-1",
          academicYear: "2025-26",
          electiveBatchMappings: [
            { electiveBatchId: "eb-1", facultyId: "f-2" },
            { electiveBatchId: "eb-2", facultyId: "f-1" },
          ],
        },
        "user-1",
        { requesterRole: "department" }
      )
    ).resolves.toBeDefined();
  });

  it("blocks faculty reassignment for PW once attendance/marks exist (C3)", async () => {
    hasAttendanceOrMarks = true;

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.upsertMapping(
        {
          courseId: "course-1",
          semesterId: "sem-1",
          academicYear: "2025-26",
          electiveBatchMappings: [
            { electiveBatchId: "eb-1", facultyId: "f-1" },
          ],
        },
        "user-1",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "Faculty assignments cannot be modified after attendance or marks have been recorded for this course"
    );
  });

  it("persists faculty via ElectiveBatchFaculty and never creates CourseAssignment rows (A5b)", async () => {
    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    const res = await CourseAssignmentService.upsertMapping(
      {
        courseId: "course-1",
        semesterId: "sem-1",
        academicYear: "2025-26",
        electiveBatchMappings: [
          { electiveBatchId: "eb-1", facultyId: "f-1" },
          { electiveBatchId: "eb-2", facultyId: "f-2" },
        ],
      },
      "user-1",
      { requesterRole: "department" }
    );

    expect(res.status).toBe("success");
    expect(electiveBatchFacultyDeleteCount).toBe(1);
    expect(electiveBatchFacultyCreateCount).toBe(2);
    expect(courseAssignmentCreateCount).toBe(0);
  });

  it("allows faculty reassignment for PW when no attendance/marks exist (C2 full-state)", async () => {
    electiveBatchRecords = [{ id: "eb-1" }];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    const res = await CourseAssignmentService.upsertMapping(
      {
        courseId: "course-1",
        semesterId: "sem-1",
        academicYear: "2025-26",
        electiveBatchMappings: [{ electiveBatchId: "eb-1", facultyId: "f-2" }],
      },
      "user-1",
      { requesterRole: "department" }
    );

    expect(res.status).toBe("success");
    expect(electiveBatchFacultyCreateCount).toBe(1);
    expect(electiveBatchFacultyDeleteCount).toBe(1);
  });

  it("rejects an incomplete PW mapping naming the unmapped group with its section (hidden-section completeness)", async () => {
    electiveBatchRecords = [
      {
        id: "eb-1",
        name: "G-001",
        section: { id: "sec-a", name: "PA" },
      },
      {
        id: "eb-2",
        name: "G-002",
        section: { id: "sec-b", name: "PB" },
      },
    ];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.upsertMapping(
        {
          courseId: "course-1",
          semesterId: "sem-1",
          academicYear: "2025-26",
          electiveBatchMappings: [
            { electiveBatchId: "eb-1", facultyId: "f-1" },
            { electiveBatchId: "eb-2", facultyId: null },
          ],
        },
        "user-1",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "Project group faculty mapping is incomplete. PB — G-002 has no faculty assigned"
    );

    expect(electiveBatchFacultyDeleteCount).toBe(0);
    expect(electiveBatchFacultyCreateCount).toBe(0);
  });

  it("rejects an incomplete PW mapping when a group is entirely missing from the payload (zero writes)", async () => {
    electiveBatchRecords = [
      { id: "eb-1", name: "G-001", section: { id: "sec-a", name: "PA" } },
      { id: "eb-2", name: "G-002", section: { id: "sec-b", name: "PB" } },
    ];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.upsertMapping(
        {
          courseId: "course-1",
          semesterId: "sem-1",
          academicYear: "2025-26",
          electiveBatchMappings: [
            { electiveBatchId: "eb-1", facultyId: "f-1" },
          ],
        },
        "user-1",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "Project group faculty mapping is incomplete. PB — G-002 has no faculty assigned"
    );

    expect(electiveBatchFacultyDeleteCount).toBe(0);
    expect(electiveBatchFacultyCreateCount).toBe(0);
  });

  it("rejects an incomplete DEPARTMENT_WIDE PW mapping without a section prefix", async () => {
    courseRecord = {
      id: "course-1",
      courseType: "PW",
      approvalStatus: "DRAFT",
      projectGroupingScope: "DEPARTMENT_WIDE",
    };
    electiveBatchRecords = [
      { id: "eb-1", name: "G-001", section: null },
      { id: "eb-2", name: "G-002", section: null },
    ];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.upsertMapping(
        {
          courseId: "course-1",
          semesterId: "sem-1",
          academicYear: "2025-26",
          electiveBatchMappings: [
            { electiveBatchId: "eb-1", facultyId: "f-1" },
            { electiveBatchId: "eb-2", facultyId: null },
          ],
        },
        "user-1",
        { requesterRole: "department" }
      )
    ).rejects.toThrow(
      "Project group faculty mapping is incomplete. G-002 has no faculty assigned"
    );

    expect(electiveBatchFacultyDeleteCount).toBe(0);
  });

  it("does not apply the completeness gate to PE courses", async () => {
    courseRecord = {
      id: "course-1",
      courseType: "PE",
      approvalStatus: "DRAFT",
    };
    electiveBatchRecords = [{ id: "eb-1" }, { id: "eb-2" }];

    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    const res = await CourseAssignmentService.upsertMapping(
      {
        courseId: "course-1",
        semesterId: "sem-1",
        academicYear: "2025-26",
        electiveBatchMappings: [{ electiveBatchId: "eb-1", facultyId: "f-1" }],
      },
      "user-1",
      { requesterRole: "department" }
    );

    expect(res.status).toBe("success");
    expect(electiveBatchFacultyCreateCount).toBe(1);
    expect(electiveBatchFacultyDeleteCount).toBe(1);
  });
});

describe("CourseAssignmentService upsertMapping (section-mapped)", () => {
  beforeEach(() => {
    sessionDepartment = {
      id: "dep-session",
      name: "Session Department",
      type: "ENGINEERING",
      abbreviation: "SD",
    };
    courseRecord = {
      id: "course-1",
      courseType: "PC",
      approvalStatus: "DRAFT",
    };
    electiveBatchRecords = [];
    facultyRecords = [
      { id: "f-1", departmentId: "dep-session" },
      { id: "f-2", departmentId: "dep-other" },
    ];
    hasAttendanceOrMarks = false;
    courseAssignmentCreateCount = 0;
    electiveBatchFacultyCreateCount = 0;
    electiveBatchFacultyDeleteCount = 0;
  });

  it("still rejects cross-department faculty for section mappings", async () => {
    const { CourseAssignmentService } = await import(
      "./course-assignment.service"
    );

    await expect(
      CourseAssignmentService.upsertMapping(
        {
          courseId: "course-1",
          semesterId: "sem-1",
          academicYear: "2025-26",
          sectionMappings: [
            {
              sectionId: "sec-1",
              theoryFacultyId: "f-2",
              labFacultyByBatch: [],
            },
          ],
        },
        "user-1",
        { requesterRole: "department" }
      )
    ).rejects.toThrow("Faculty f-2 does not belong to your department");
  });
});
