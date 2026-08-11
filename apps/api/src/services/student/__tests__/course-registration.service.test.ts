import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CourseRegistration } from "../course-registration.service";

const registeredCourseIds: string[] = [];

let txRegisteredCount = 0;

const dbMock = {
  student: {
    findUnique: async () => ({
      id: "student-1",
      departmentName: "CSE",
      semesterId: "semester-1",
      academicTermId: "term-1",
      currentSemester: 3,
      programType: "UG",
      studentSections: [{ section: { cycle: "NONE" } }],
    }),
  },
  department: {
    findUnique: async () => ({ id: "dept-1" }),
  },
  registrationWindow: {
    findFirst: async () => ({ isOpen: true }),
  },
  courseRegistration: {
    count: async () => 0,
    createMany: async () => {},
  },
  course: {
    findMany: async () => [
      {
        id: "course-core",
        code: "CS301",
        name: "Core Subject",
        courseType: "PC",
        lectureCredits: 3,
        tutorialCredits: 0,
        practicalCredits: 0,
        skillCredits: 0,
        totalCredits: 3,
        numberOfBatches: null,
        studentsPerBatch: null,
        _count: { registrations: 0 },
      },
      {
        id: "course-pe",
        code: "PE101",
        name: "PE Subject",
        courseType: "PE",
        lectureCredits: 3,
        tutorialCredits: 0,
        practicalCredits: 0,
        skillCredits: 0,
        totalCredits: 3,
        numberOfBatches: 1,
        studentsPerBatch: 1,
        _count: { registrations: 0 },
      },
    ],
  },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      $queryRaw: async () => [{ id: "course-pe" }],
      course: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id === "course-pe") {
            return {
              id: "course-pe",
              code: "PE101",
              numberOfBatches: 1,
              studentsPerBatch: 1,
            };
          }
          return {
            id: where.id,
            code: "CS301",
            numberOfBatches: null,
            studentsPerBatch: null,
          };
        },
        update: async () => ({ id: "course-pe", electiveMappingVersion: 2 }),
      },
      courseRegistration: {
        count: async ({ where }: { where: { courseId: string } }) =>
          where.courseId === "course-pe" ? txRegisteredCount : 0,
        createMany: async ({
          data,
        }: {
          data: { studentId: string; courseId: string }[];
        }) => {
          registeredCourseIds.push(...data.map((d) => d.courseId));
        },
      },
    };
    return callback(tx);
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, options: { code?: string } = {}) {
        super(message);
        this.code = options.code ?? "";
      }
    },
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
  logger: {
    error: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
  },
}));

describe("CourseRegistration PE capacity guard", () => {
  beforeEach(() => {
    registeredCourseIds.length = 0;
    txRegisteredCount = 0;
  });

  test("rejects submission when PE course hit capacity inside the transaction", async () => {
    txRegisteredCount = 1;

    await expect(
      CourseRegistration.submitRegistration("user-1", {
        courseIds: ["course-core", "course-pe"],
      })
    ).rejects.toThrow(
      "Course PE101 is full (1/1). Please select another Professional Elective."
    );
    expect(registeredCourseIds).toHaveLength(0);
  });

  test("accepts last available seat when count stays below capacity", async () => {
    txRegisteredCount = 0;

    const result = await CourseRegistration.submitRegistration("user-1", {
      courseIds: ["course-core", "course-pe"],
    });

    expect(result.status).toBe("success");
    expect(registeredCourseIds).toEqual(["course-core", "course-pe"]);
  });

  test("requires exactly one PE course when PE is in the curriculum", async () => {
    await expect(
      CourseRegistration.submitRegistration("user-1", {
        courseIds: ["course-core"],
      })
    ).rejects.toThrow("Please select exactly one Professional Elective (PE)");
  });

  test("rejects non-curriculum course ids", async () => {
    await expect(
      CourseRegistration.submitRegistration("user-1", {
        courseIds: ["course-core", "course-pe", "course-mystery"],
      })
    ).rejects.toThrow(
      "Selected courses do not belong to your approved curriculum"
    );
  });
});
