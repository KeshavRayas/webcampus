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
    courseType: string;
    semesterId: string;
    semesterNumber: number;
    approvalStatus: "APPROVED" | "PENDING";
    semester: {
      id: string;
      academicTermId: string;
      programType: "UG" | "PG";
      academicTerm?: {
        id: string;
        year: string;
        type: "odd" | "even";
      };
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

type ElectiveBatchFacultyRecord = {
  id: string;
  facultyId: string;
  semester: number;
  academicYear: string;
  electiveBatch: {
    id: string;
    name: string;
    _count: {
      studentAssignments: number;
    };
  };
  course: {
    id: string;
    code: string;
    name: string;
    courseType: string;
    semesterId: string;
    semesterNumber: number;
    approvalStatus: "APPROVED" | "PENDING";
    semester: {
      id: string;
      academicTermId: string;
      programType: "UG" | "PG";
      academicTerm?: {
        id: string;
        year: string;
        type: "odd" | "even";
      };
    };
  };
};

type ElectiveWhere = {
  AND?: ElectiveWhere[];
  OR?: ElectiveWhere[];
  facultyId?: string;
  academicYear?: string;
  course?: {
    id?: string;
    approvalStatus?: string;
    semesterNumber?: number;
    code?: ContainsFilter;
    name?: ContainsFilter;
    semester?: {
      id?: string;
      academicTermId?: string;
      programType?: "UG" | "PG";
    };
  };
  electiveBatch?: {
    id?: string;
    name?: ContainsFilter;
  };
};

type DbElectiveArgs = {
  where?: ElectiveWhere;
  skip?: number;
  take?: number;
};

const facultyByUserId: Record<string, string> = {
  "user-1": "faculty-1",
  "user-2": "faculty-2",
};

let assignments: AssignmentRecord[] = [];
let students: StudentRecord[] = [];
let electiveRecords: ElectiveBatchFacultyRecord[] = [];
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

const electiveMatchesWhere = (
  record: ElectiveBatchFacultyRecord,
  whereInput: ElectiveWhere | null | undefined
): boolean => {
  if (!whereInput) {
    return true;
  }

  if (Array.isArray(whereInput.AND)) {
    return whereInput.AND.every((condition) =>
      electiveMatchesWhere(record, condition)
    );
  }

  if (Array.isArray(whereInput.OR)) {
    return whereInput.OR.some((condition) =>
      electiveMatchesWhere(record, condition)
    );
  }

  if (whereInput.facultyId) {
    return record.facultyId === whereInput.facultyId;
  }

  if (whereInput.academicYear) {
    return record.academicYear === whereInput.academicYear;
  }

  if (whereInput.course?.id) {
    return record.course.id === whereInput.course.id;
  }

  if (whereInput.course?.approvalStatus) {
    return record.course.approvalStatus === whereInput.course.approvalStatus;
  }

  if (whereInput.course?.semesterNumber !== undefined) {
    return record.course.semesterNumber === whereInput.course.semesterNumber;
  }

  if (whereInput.course?.semester?.id) {
    return record.course.semester.id === whereInput.course.semester.id;
  }

  if (whereInput.course?.semester?.academicTermId) {
    return (
      record.course.semester.academicTermId ===
      whereInput.course.semester.academicTermId
    );
  }

  if (whereInput.course?.semester?.programType) {
    return (
      record.course.semester.programType ===
      whereInput.course.semester.programType
    );
  }

  if (whereInput.course?.code?.contains) {
    return includesText(record.course.code, whereInput.course.code.contains);
  }

  if (whereInput.course?.name?.contains) {
    return includesText(record.course.name, whereInput.course.name.contains);
  }

  if (whereInput.electiveBatch?.id) {
    return record.electiveBatch.id === whereInput.electiveBatch.id;
  }

  if (whereInput.electiveBatch?.name?.contains) {
    return includesText(
      record.electiveBatch.name,
      whereInput.electiveBatch.name.contains
    );
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
      return paginate(filtered, skip, take).map((assignment) => ({
        ...assignment,
        course: {
          ...assignment.course,
          semester: {
            ...assignment.course.semester,
            academicTerm: assignment.course.semester.academicTerm ?? {
              id: assignment.course.semester.academicTermId,
              year: "2025-26",
              type: "odd",
            },
          },
        },
      }));
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
    count: async ({ where }: DbElectiveArgs) => {
      return electiveRecords.filter((item) => electiveMatchesWhere(item, where))
        .length;
    },
    findMany: async ({ where }: DbElectiveArgs) => {
      return electiveRecords.filter((item) =>
        electiveMatchesWhere(item, where)
      );
    },
    findUnique: async ({ where }: DbFindUniqueArgs) => {
      const record = electiveRecords.find((item) => item.id === where.id);
      if (!record) {
        return null;
      }
      return {
        id: record.id,
        facultyId: record.facultyId,
        semester: record.semester,
        academicYear: record.academicYear,
        course: {
          id: record.course.id,
          code: record.course.code,
          name: record.course.name,
          semesterId: record.course.semesterId,
          semesterNumber: record.course.semesterNumber,
          approvalStatus: record.course.approvalStatus,
          semester: {
            id: record.course.semester.id,
            academicTermId: record.course.semester.academicTermId,
            programType: record.course.semester.programType,
          },
        },
        electiveBatch: {
          id: record.electiveBatch.id,
          name: record.electiveBatch.name,
        },
      };
    },
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
    electiveRecords = [];

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
          courseType: "PC",
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
          courseType: "PC",
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
          courseType: "PC",
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
          courseType: "PC",
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

  it("keeps PC courses visible when a batch filter is selected", async () => {
    const { FacultyHandlingService } = await import("../handling.service");

    const response = await FacultyHandlingService.getHandlingAssignments(
      "user-1",
      "THEORY",
      { batchId: "batch-1", page: 1, limit: 10 }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }
    expect(response.data.items.map((item) => item.assignmentId)).toContain(
      "asgn-theory-approved"
    );

    const where = lastAssignmentWhere as {
      AND?: Array<Record<string, unknown>>;
    };
    expect(
      where.AND?.some((condition) => condition.batchId !== undefined)
    ).toBe(false);
    expect(where.AND?.some((condition) => condition.batch !== undefined)).toBe(
      false
    );
  });

  it("does not apply the section filter to elective (PE/OE/PW) rows", async () => {
    electiveRecords = [
      {
        id: "ebf-1",
        facultyId: "faculty-1",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-1",
          name: "G-001",
          _count: { studentAssignments: 3 },
        },
        course: {
          id: "course-pw",
          code: "PW301",
          name: "Project",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
      },
    ];

    const { FacultyHandlingService } = await import("../handling.service");

    const response = await FacultyHandlingService.getHandlingAssignments(
      "user-1",
      "THEORY",
      { sectionId: "section-a", page: 1, limit: 10 }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }
    const electiveRows = response.data.items.filter((item) => item.isElective);
    expect(electiveRows).toHaveLength(1);
    expect(electiveRows[0]?.assignmentId).toBe("ebf-1");
    expect(electiveRows[0]?.section).toBe("G-001");
    expect(electiveRows[0]?.studentCount).toBe(3);
  });

  it("reports PW group student counts from ElectiveStudentAssignment", async () => {
    electiveRecords = [
      {
        id: "ebf-1",
        facultyId: "faculty-1",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-1",
          name: "G-001",
          _count: { studentAssignments: 3 },
        },
        course: {
          id: "course-pw",
          code: "PW301",
          name: "Project",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
      },
      {
        id: "ebf-2",
        facultyId: "faculty-1",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-2",
          name: "G-002",
          _count: { studentAssignments: 0 },
        },
        course: {
          id: "course-pw",
          code: "PW301",
          name: "Project",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
      },
    ];

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
    const electiveRows = response.data.items.filter((item) => item.isElective);
    expect(electiveRows).toHaveLength(2);
    expect(
      electiveRows.find((row) => row.section === "G-001")?.studentCount
    ).toBe(3);
    expect(
      electiveRows.find((row) => row.section === "G-002")?.studentCount
    ).toBe(0);
  });

  it("only returns the current faculty's own PW groups", async () => {
    electiveRecords = [
      {
        id: "ebf-1",
        facultyId: "faculty-1",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-1",
          name: "G-001",
          _count: { studentAssignments: 2 },
        },
        course: {
          id: "course-pw",
          code: "PW301",
          name: "Project",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
      },
      {
        id: "ebf-other",
        facultyId: "faculty-2",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-other",
          name: "G-OTHER",
          _count: { studentAssignments: 5 },
        },
        course: {
          id: "course-pw-2",
          code: "PW302",
          name: "Project II",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
      },
    ];

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
    const electiveRows = response.data.items.filter((item) => item.isElective);
    expect(electiveRows).toHaveLength(1);
    expect(electiveRows[0]?.assignmentId).toBe("ebf-1");
  });

  it("merges PC and elective rows without dropping valid assignments", async () => {
    electiveRecords = [
      {
        id: "ebf-1",
        facultyId: "faculty-1",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-1",
          name: "G-001",
          _count: { studentAssignments: 2 },
        },
        course: {
          id: "course-pw",
          code: "PW301",
          name: "Project",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
          },
        },
      },
    ];

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
    const ids = response.data.items.map((item) => item.assignmentId);
    expect(ids).toContain("asgn-theory-approved");
    expect(ids).toContain("ebf-1");
    expect(response.data.pagination.total).toBe(2);
  });

  it("excludes batch-managed courses from LAB filter options", async () => {
    electiveRecords = [
      {
        id: "ebf-1",
        facultyId: "faculty-1",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-1",
          name: "G-001",
          _count: { studentAssignments: 2 },
        },
        course: {
          id: "course-pw",
          code: "PW301",
          name: "Project",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
            academicTerm: { id: "term-1", year: "2025-26", type: "odd" },
          },
        },
      },
    ];

    const { FacultyHandlingService } = await import("../handling.service");

    const response = await FacultyHandlingService.getFilterOptions(
      "user-1",
      "LAB"
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }
    expect(
      response.data.courses.some((course) => course.courseType === "PW")
    ).toBe(false);
    expect(
      response.data.sections.some((section) => section.isElectiveBatch === true)
    ).toBe(false);
    expect(
      response.data.batches.some((batch) => batch.isElective === true)
    ).toBe(false);
  });

  it("includes elective courses in THEORY filter options", async () => {
    electiveRecords = [
      {
        id: "ebf-1",
        facultyId: "faculty-1",
        semester: 3,
        academicYear: "2025-26",
        electiveBatch: {
          id: "eb-1",
          name: "G-001",
          _count: { studentAssignments: 2 },
        },
        course: {
          id: "course-pw",
          code: "PW301",
          name: "Project",
          courseType: "PW",
          semesterId: "semester-1",
          semesterNumber: 3,
          approvalStatus: "APPROVED",
          semester: {
            id: "semester-1",
            academicTermId: "term-1",
            programType: "UG",
            academicTerm: { id: "term-1", year: "2025-26", type: "odd" },
          },
        },
      },
    ];

    const { FacultyHandlingService } = await import("../handling.service");

    const response = await FacultyHandlingService.getFilterOptions(
      "user-1",
      "THEORY"
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }
    expect(
      response.data.courses.some(
        (course) => course.courseType === "PW" && course.code === "PW301"
      )
    ).toBe(true);
    expect(
      response.data.sections.some(
        (section) =>
          section.isElectiveBatch === true && section.name === "G-001"
      )
    ).toBe(true);
    expect(
      response.data.batches.some(
        (batch) => batch.isElective === true && batch.name === "G-001"
      )
    ).toBe(true);
  });
});
