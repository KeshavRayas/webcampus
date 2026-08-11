/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

type AssignmentType = "THEORY" | "LAB";

type AssignmentRecord = {
  id: string;
  facultyId: string;
  assignmentType: AssignmentType;
  semester: number;
  academicYear: string;
  sectionId: string;
  batchId: string | null;
  course: {
    id: string;
    code: string;
    name: string;
    semesterId: string;
    semesterNumber: number;
    approvalStatus: "APPROVED" | "PENDING";
    semester: {
      id: string;
      academicTermId: string;
      programType: "UG" | "PG";
    };
  };
  section: {
    id: string;
    name: string;
    semesterId: string;
  };
  batch: {
    id: string;
    name: string;
    _count: {
      students: number;
    };
  } | null;
};

type StudentRecord = {
  id: string;
  usn: string;
  user: {
    name: string;
    email: string;
  };
  studentSections: Array<{
    sectionId: string;
    semester: number;
    academicYear: string;
    section: {
      id: string;
      name: string;
    };
  }>;
  batches: Array<{
    id: string;
    name: string;
  }>;
};

type ContainsFilter = {
  contains?: string;
};

type AssignmentWhere = {
  AND?: AssignmentWhere[];
  OR?: AssignmentWhere[];
  facultyId?: string;
  assignmentType?: AssignmentType;
  semester?: number;
  academicYear?: string;
  batchId?: string | { not?: string | null } | null;
  batch?: {
    name?: ContainsFilter;
  };
  course?: {
    approvalStatus?: string;
    code?: ContainsFilter;
    name?: ContainsFilter;
    semesterId?: string;
    semester?: {
      academicTermId?: string;
      programType?: "UG" | "PG";
    };
  };
  section?: {
    name?: ContainsFilter;
    semesterId?: string;
  };
  sectionId?: string;
};

type StudentWhere = {
  AND?: StudentWhere[];
  OR?: StudentWhere[];
  studentSections?: {
    some?: {
      academicYear?: string;
      sectionId?: string;
      semester?: number;
    };
  };
  batches?: {
    some?: {
      id?: string;
    };
  };
  usn?: ContainsFilter;
  user?: {
    email?: ContainsFilter;
    name?: ContainsFilter;
  };
};

type DbFindUniqueArgs = {
  where: {
    id?: string;
    userId?: string;
  };
};

type DbAssignmentArgs = {
  where?: AssignmentWhere;
  skip?: number;
  take?: number;
};

type DbStudentArgs = {
  where?: StudentWhere;
  skip?: number;
  take?: number;
};

type DbStudentSectionCountArgs = {
  where: {
    academicYear?: string;
    sectionId?: string;
    semester?: number;
  };
};

const facultyByUserId: Record<string, string> = {
  "user-1": "faculty-1",
  "user-2": "faculty-2",
};

let assignments: AssignmentRecord[] = [];
let students: StudentRecord[] = [];
let lastAssignmentWhere: unknown = null;

const paginate = <T>(items: T[], skip: number, take: number): T[] => {
  return items.slice(skip, skip + take);
};

const includesText = (value: string, text: string): boolean => {
  return value.toLowerCase().includes(text.toLowerCase());
};

const assignmentMatchesWhere = (
  assignment: AssignmentRecord,
  whereInput: AssignmentWhere | null | undefined
): boolean => {
  if (!whereInput) {
    return true;
  }

  if (Array.isArray(whereInput.AND)) {
    return whereInput.AND.every((condition) =>
      assignmentMatchesWhere(assignment, condition)
    );
  }

  if (Array.isArray(whereInput.OR)) {
    return whereInput.OR.some((condition) =>
      assignmentMatchesWhere(assignment, condition)
    );
  }

  const condition = whereInput;

  if (condition.facultyId) {
    return assignment.facultyId === condition.facultyId;
  }

  if (condition.assignmentType) {
    return assignment.assignmentType === condition.assignmentType;
  }

  if (condition.semester !== undefined) {
    return assignment.semester === condition.semester;
  }

  if (condition.academicYear) {
    return assignment.academicYear === condition.academicYear;
  }

  const batchIdFilter = condition.batchId;
  if (typeof batchIdFilter === "string") {
    return assignment.batchId === batchIdFilter;
  }

  if (
    typeof batchIdFilter === "object" &&
    batchIdFilter !== null &&
    batchIdFilter.not !== undefined
  ) {
    return assignment.batchId !== null;
  }

  if (condition.course?.approvalStatus) {
    return assignment.course.approvalStatus === condition.course.approvalStatus;
  }

  if (condition.course?.semesterId) {
    return (
      assignment.course.id === assignment.course.id &&
      assignment.sectionId === assignment.sectionId &&
      assignment.course.semesterId === condition.course.semesterId
    );
  }

  if (condition.course?.semester?.academicTermId) {
    return (
      assignment.course.semester?.academicTermId ===
      condition.course.semester.academicTermId
    );
  }

  if (condition.course?.semester?.programType) {
    return (
      assignment.course.semester?.programType ===
      condition.course.semester.programType
    );
  }

  if (condition.section?.semesterId) {
    return (
      assignment.sectionId === assignment.sectionId &&
      assignment.course.semesterId === condition.section.semesterId
    );
  }

  if (condition.sectionId) {
    return assignment.sectionId === condition.sectionId;
  }

  if (condition.section?.name?.contains) {
    return includesText(
      assignment.section.name,
      condition.section.name.contains
    );
  }

  if (condition.batchId) {
    return assignment.batchId === condition.batchId;
  }

  if (condition.batch?.name?.contains) {
    if (!assignment.batch) {
      return false;
    }

    return includesText(assignment.batch.name, condition.batch.name.contains);
  }

  if (condition.course?.code?.contains) {
    return includesText(assignment.course.code, condition.course.code.contains);
  }

  if (condition.course?.name?.contains) {
    return includesText(assignment.course.name, condition.course.name.contains);
  }

  return true;
};

const studentMatchesWhere = (
  student: StudentRecord,
  where: StudentWhere | null | undefined
): boolean => {
  if (!where) {
    return true;
  }

  if (Array.isArray(where.AND)) {
    return where.AND.every((condition) =>
      studentMatchesWhere(student, condition)
    );
  }

  if (Array.isArray(where.OR)) {
    return where.OR.some((condition) =>
      studentMatchesWhere(student, condition)
    );
  }

  if (where.studentSections?.some) {
    const target = where.studentSections.some;
    const inSection = student.studentSections.some(
      (entry) =>
        entry.sectionId === target.sectionId &&
        entry.semester === target.semester &&
        entry.academicYear === target.academicYear
    );
    if (!inSection) {
      return false;
    }
  }

  const targetBatchId = where.batches?.some?.id;
  if (targetBatchId) {
    if (!student.batches.some((batch) => batch.id === targetBatchId)) {
      return false;
    }
  }

  if (where.usn?.contains) {
    return includesText(student.usn, where.usn.contains);
  }

  if (where.user?.name?.contains) {
    return includesText(student.user.name, where.user.name.contains);
  }

  if (where.user?.email?.contains) {
    return includesText(student.user.email, where.user.email.contains);
  }

  return true;
};

const dbMock = {
  faculty: {
    findUnique: async ({ where }: DbFindUniqueArgs) => {
      if (!where.userId) {
        return null;
      }

      const facultyId = facultyByUserId[where.userId];
      return facultyId ? { id: facultyId } : null;
    },
  },
  courseAssignment: {
    count: async ({ where }: DbAssignmentArgs) => {
      lastAssignmentWhere = where;
      return assignments.filter((item) => assignmentMatchesWhere(item, where))
        .length;
    },
    findMany: async ({ where, skip = 0, take = 10 }: DbAssignmentArgs) => {
      const filtered = assignments.filter((item) =>
        assignmentMatchesWhere(item, where)
      );
      return paginate(filtered, skip, take);
    },
    findUnique: async ({ where }: DbFindUniqueArgs) => {
      const assignment = assignments.find((item) => item.id === where.id);
      if (!assignment) {
        return null;
      }
      return {
        id: assignment.id,
        facultyId: assignment.facultyId,
        assignmentType: assignment.assignmentType,
        sectionId: assignment.sectionId,
        batchId: assignment.batchId,
        semester: assignment.semester,
        academicYear: assignment.academicYear,
        course: {
          id: assignment.course.id,
          code: assignment.course.code,
          name: assignment.course.name,
          semesterId: "semester-1",
          semesterNumber: assignment.semester,
          approvalStatus: assignment.course.approvalStatus,
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
        section: {
          id: assignment.section.id,
          name: assignment.section.name,
          semesterId: "semester-1",
        },
        batch: assignment.batch
          ? {
              id: assignment.batch.id,
              name: assignment.batch.name,
            }
          : null,
      };
    },
  },
  studentSection: {
    count: async ({ where }: DbStudentSectionCountArgs) => {
      return students.filter((student) =>
        student.studentSections.some(
          (entry) =>
            entry.sectionId === where.sectionId &&
            entry.semester === where.semester &&
            entry.academicYear === where.academicYear
        )
      ).length;
    },
    findMany: async () => {
      return students.flatMap((student) =>
        student.studentSections.map((entry) => ({
          studentId: student.id,
          sectionId: entry.sectionId,
          semester: entry.semester,
          academicYear: entry.academicYear,
        }))
      );
    },
  },
  section: {
    findUnique: async ({ where }: DbFindUniqueArgs) => {
      const fromAssignment = assignments.find(
        (item) => item.sectionId === where.id
      );
      return fromAssignment ? { name: fromAssignment.section.name } : null;
    },
  },
  batch: {
    findUnique: async ({ where }: DbFindUniqueArgs) => {
      const fromAssignment = assignments.find(
        (item) => item.batchId === where.id
      );
      return fromAssignment?.batch ? { name: fromAssignment.batch.name } : null;
    },
  },
  student: {
    count: async ({ where }: DbStudentArgs) => {
      return students.filter((student) => studentMatchesWhere(student, where))
        .length;
    },
    findMany: async ({ where, skip = 0, take = 10 }: DbStudentArgs) => {
      const filtered = students.filter((student) =>
        studentMatchesWhere(student, where)
      );
      return paginate(filtered, skip, take).map((student) => ({
        id: student.id,
        usn: student.usn,
        user: student.user,
        studentSections: student.studentSections.map((entry) => ({
          section: entry.section,
        })),
        batches: student.batches,
      }));
    },
  },
  electiveBatchFaculty: {
    findMany: async () => [],
    findUnique: async () => null,
  },
  courseRegistration: {
    findMany: async () =>
      students.map((student) => ({
        courseId: "course-1",
        studentId: student.id,
      })),
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
  },
}));

describe("FacultyHandlingService", () => {
  beforeEach(() => {
    lastAssignmentWhere = null;

    assignments = [
      {
        id: "asgn-theory-approved",
        facultyId: "faculty-1",
        assignmentType: "THEORY",
        semester: 3,
        academicYear: "2025-26",
        sectionId: "section-a",
        batchId: null,
        course: {
          id: "course-1",
          code: "CS301",
          name: "Algorithms",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
        section: {
          id: "section-a",
          name: "A",
          semesterId: "semester-1",
        },
        batch: null,
      },
      {
        id: "asgn-lab-approved",
        facultyId: "faculty-1",
        assignmentType: "LAB",
        semester: 3,
        academicYear: "2025-26",
        sectionId: "section-a",
        batchId: "batch-1",
        course: {
          id: "course-2",
          code: "CSL37",
          name: "Algorithms Lab",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
        section: {
          id: "section-a",
          name: "A",
          semesterId: "semester-1",
        },
        batch: {
          id: "batch-1",
          name: "Batch 1",
          _count: {
            students: 2,
          },
        },
      },
      {
        id: "asgn-theory-pending",
        facultyId: "faculty-1",
        assignmentType: "THEORY",
        semester: 3,
        academicYear: "2025-26",
        sectionId: "section-a",
        batchId: null,
        course: {
          id: "course-3",
          code: "CS302",
          name: "Operating Systems",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "PENDING",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
        section: {
          id: "section-a",
          name: "A",
          semesterId: "semester-1",
        },
        batch: null,
      },
      {
        id: "asgn-other-faculty",
        facultyId: "faculty-2",
        assignmentType: "THEORY",
        semester: 3,
        academicYear: "2025-26",
        sectionId: "section-b",
        batchId: null,
        course: {
          id: "course-4",
          code: "ME301",
          name: "Thermodynamics",
          semesterId: "semester-2",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-2",
            academicTermId: "term-2",
            programType: "UG",
          },
        },
        section: {
          id: "section-b",
          name: "B",
          semesterId: "semester-2",
        },
        batch: null,
      },
    ];

    students = [
      {
        id: "stu-1",
        usn: "1BM22CS001",
        user: { name: "Alice", email: "alice@example.com" },
        studentSections: [
          {
            sectionId: "section-a",
            semester: 3,
            academicYear: "2025-26",
            section: { id: "section-a", name: "A" },
          },
        ],
        batches: [{ id: "batch-1", name: "Batch 1" }],
      },
      {
        id: "stu-2",
        usn: "1BM22CS002",
        user: { name: "Bob", email: "bob@example.com" },
        studentSections: [
          {
            sectionId: "section-a",
            semester: 3,
            academicYear: "2025-26",
            section: { id: "section-a", name: "A" },
          },
        ],
        batches: [{ id: "batch-1", name: "Batch 1" }],
      },
      {
        id: "stu-3",
        usn: "1BM22CS003",
        user: { name: "Charlie", email: "charlie@example.com" },
        studentSections: [
          {
            sectionId: "section-a",
            semester: 3,
            academicYear: "2025-26",
            section: { id: "section-a", name: "A" },
          },
        ],
        batches: [],
      },
    ];
  });

  it("lists only approved THEORY assignments", async () => {
    const { FacultyHandlingService } = await import("../handling.service");

    const response = await FacultyHandlingService.getHandlingAssignments(
      "user-1",
      "THEORY",
      { page: 1, limit: 10 }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0]?.assignmentId).toBe("asgn-theory-approved");
    expect(response.data.items[0]?.studentCount).toBe(3);
  });

  it("lists only approved LAB assignments", async () => {
    const { FacultyHandlingService } = await import("../handling.service");

    const response = await FacultyHandlingService.getHandlingAssignments(
      "user-1",
      "LAB",
      { page: 1, limit: 10 }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0]?.assignmentId).toBe("asgn-lab-approved");
    expect(response.data.items[0]?.batchName).toBe("Batch 1");
    expect(response.data.items[0]?.studentCount).toBe(2);
  });

  it("rejects cross-faculty student access", async () => {
    const { FacultyHandlingService } = await import("../handling.service");

    await expect(
      FacultyHandlingService.getStudentsByAssignment(
        "user-1",
        "asgn-other-faculty",
        "THEORY",
        {}
      )
    ).rejects.toThrow(
      "Forbidden: assignment does not belong to current faculty"
    );
  });

  it("returns paginated students for assignment drill-down", async () => {
    const { FacultyHandlingService } = await import("../handling.service");

    const response = await FacultyHandlingService.getStudentsByAssignment(
      "user-1",
      "asgn-theory-approved",
      "THEORY",
      { page: 2, limit: 2 }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0]?.usn).toBe("1BM22CS003");
    expect(response.data.items[0]?.name).toBe("Charlie");
    expect(response.data.items[0]?.section).toBe("A");
    expect(response.data.pagination.page).toBe(2);
    expect(response.data.pagination.limit).toBe(2);
    expect(response.data.pagination.total).toBe(3);
    expect(response.data.pagination.hasPreviousPage).toBe(true);
    expect(response.data.pagination.hasNextPage).toBe(false);
  });

  it("applies search and term filters in assignment query", async () => {
    const { FacultyHandlingService } = await import("../handling.service");

    await FacultyHandlingService.getHandlingAssignments("user-1", "THEORY", {
      search: "algo",
      academicTermId: "term-1",
      programType: "UG",
      semesterId: "semester-1",
      sectionId: "section-a",
      page: 1,
      limit: 10,
    });

    const where = lastAssignmentWhere as {
      AND?: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(where?.AND)).toBe(true);
    expect(
      where.AND?.some((condition) => condition.facultyId === "faculty-1")
    ).toBe(true);
    expect(
      where.AND?.some((condition) => condition.assignmentType === "THEORY")
    ).toBe(true);
    expect(
      where.AND?.some(
        (condition) =>
          typeof condition.course === "object" &&
          condition.course !== null &&
          "approvalStatus" in condition.course
      )
    ).toBe(true);
    expect(
      where.AND?.some(
        (condition) =>
          typeof condition.section === "object" &&
          condition.section !== null &&
          "name" in condition.section
      )
    ).toBe(true);
    expect(
      where.AND?.some(
        (condition) =>
          Array.isArray(condition.OR) &&
          condition.OR.some((entry) => entry.course?.code?.contains === "algo")
      )
    ).toBe(true);
  });

  it("enforces the LAB batch invariant when fetching students", async () => {
    const { FacultyHandlingService } = await import("../handling.service");

    await expect(
      FacultyHandlingService.getStudentsByAssignment(
        "user-1",
        "asgn-lab-approved",
        "LAB",
        { batchId: "other-batch" }
      )
    ).rejects.toThrow("Assignment not found for the provided filters");
  });
});
