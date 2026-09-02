/// <reference types="bun" />
import {
  buildPromotionUpdateData,
  computeOutstandingBacklogs,
  decorateBacklogCourses,
  loadSemesters,
  partitionCandidates,
} from "@webcampus/api/src/services/admin/promotion.service";
import type { PromotionCandidateItem } from "@webcampus/api/src/services/admin/promotion.service";
import { beforeEach, describe, expect, it } from "bun:test";

const fromSemester = {
  id: "sem-1",
  semesterNumber: 1,
  programType: "UG" as const,
  academicTermId: "term-1",
  academicTerm: { id: "term-1", type: "odd", year: "2025" },
};

const toSemester = {
  id: "sem-2",
  semesterNumber: 2,
  programType: "UG" as const,
  academicTermId: "term-2",
  academicTerm: { id: "term-2", type: "even", year: "2026" },
};

function makeFakeClient(semesters: Record<string, unknown>): {
  semester: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
  };
} {
  return {
    semester: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        semesters[where.id] ?? null,
    },
  };
}

describe("loadSemesters", () => {
  it("rejects when a semester is missing", async () => {
    const client = makeFakeClient({ [fromSemester.id]: fromSemester });
    expect(
      loadSemesters(fromSemester.id, "missing", client as never)
    ).rejects.toThrow("Source or target semester not found");
  });

  it("rejects non-consecutive target semester", async () => {
    const client = makeFakeClient({
      [fromSemester.id]: fromSemester,
      s3: { ...toSemester, id: "s3", semesterNumber: 3 },
    });
    expect(
      loadSemesters(fromSemester.id, "s3", client as never)
    ).rejects.toThrow("exactly one semester ahead");
  });

  it("rejects cross-program promotion", async () => {
    const client = makeFakeClient({
      [fromSemester.id]: fromSemester,
      pg: { ...toSemester, id: "pg", programType: "PG" },
    });
    expect(
      loadSemesters(fromSemester.id, "pg", client as never)
    ).rejects.toThrow("same program type");
  });

  it("accepts consecutive same-program semesters", async () => {
    const client = makeFakeClient({
      [fromSemester.id]: fromSemester,
      [toSemester.id]: toSemester,
    });
    const { from, to } = await loadSemesters(
      fromSemester.id,
      toSemester.id,
      client as never
    );
    expect(from.id).toBe("sem-1");
    expect(to.id).toBe("sem-2");
  });
});

describe("computeOutstandingBacklogs", () => {
  const reg = (
    overrides: Partial<{
      studentId: string;
      courseId: string;
      status: string;
      outcome: string;
      registeredAt: Date;
    }> = {}
  ) => ({
    studentId: "stu-1",
    courseId: "course-1",
    status: "RESULT_DECLARED",
    outcome: "P",
    registeredAt: new Date("2025-01-01"),
    ...overrides,
  });

  it("flags unresolved latest outcomes", () => {
    const result = computeOutstandingBacklogs([
      reg({ outcome: "F" }),
      reg({ courseId: "course-2", outcome: "NE" }),
    ]);
    const backlogs = result.backlogsByStudent["stu-1"];
    expect(backlogs).toHaveLength(2);
    expect(backlogs!.map((backlog) => backlog.outcome)).toEqual(["F", "NE"]);
  });

  it("ignores passed courses", () => {
    const result = computeOutstandingBacklogs([reg()]);
    expect(result.backlogsByStudent["stu-1"]).toBeUndefined();
  });

  it("uses newest declared attempt and ignores cancelled rows", () => {
    const result = computeOutstandingBacklogs([
      reg({ outcome: "F", registeredAt: new Date("2025-01-01") }),
      reg({
        status: "CANCELLED",
        outcome: "F",
        registeredAt: new Date("2025-02-01"),
      }),
      reg({ outcome: "P", registeredAt: new Date("2025-03-01") }),
    ]);
    expect(result.backlogsByStudent["stu-1"]).toBeUndefined();
  });

  it("in-flight attempt supersedes older declared failure", () => {
    const result = computeOutstandingBacklogs([
      reg({ outcome: "F", registeredAt: new Date("2025-01-01") }),
      reg({
        status: "REGISTERED",
        outcome: "PENDING",
        registeredAt: new Date("2025-02-01"),
      }),
    ]);
    expect(result.backlogsByStudent["stu-1"]).toBeUndefined();
  });
});

describe("decorateBacklogCourses", () => {
  it("fills course code and name via the client", async () => {
    const base = {
      "stu-1": [
        {
          courseId: "c1",
          courseCode: "",
          courseName: "",
          outcome: "F" as const,
        },
      ],
    };
    const client = {
      course: {
        findMany: async () => [{ id: "c1", code: "CS101", name: "Intro" }],
      },
    };
    const decorated = await decorateBacklogCourses(base, client as never);
    expect(decorated["stu-1"]![0]).toMatchObject({
      courseCode: "CS101",
      courseName: "Intro",
      outcome: "F",
    });
  });
});

describe("partitionCandidates", () => {
  const candidate: PromotionCandidateItem = {
    studentId: "stu-1",
    usn: "USN1",
    name: "A",
    departmentName: "CSE",
    currentSemester: 1,
  };

  it("buckets clean students as eligible", () => {
    const { eligible, nonEligible } = partitionCandidates(
      [candidate],
      {},
      new Set()
    );
    expect(eligible).toHaveLength(1);
    expect(nonEligible).toHaveLength(0);
  });

  it("flags outstanding backlogs", () => {
    const backlogs = {
      "stu-1": [
        {
          courseId: "c1",
          courseCode: "CS",
          courseName: "X",
          outcome: "F" as const,
        },
      ],
    };
    const { nonEligible } = partitionCandidates(
      [candidate],
      backlogs,
      new Set()
    );
    expect(nonEligible[0]?.reasons).toContain("HAS_OUTSTANDING_BACKLOGS");
    expect(nonEligible[0]?.outstandingBacklogs).toHaveLength(1);
  });

  it("flags already-promoted and can combine reasons", () => {
    const backlogs = {
      "stu-1": [
        {
          courseId: "c1",
          courseCode: "CS",
          courseName: "X",
          outcome: "W" as const,
        },
      ],
    };
    const { nonEligible } = partitionCandidates(
      [candidate],
      backlogs,
      new Set(["stu-1"])
    );
    expect(nonEligible[0]?.reasons).toEqual([
      "HAS_OUTSTANDING_BACKLOGS",
      "ALREADY_PROMOTED_TO_TARGET_TERM",
    ]);
  });
});

describe("buildPromotionUpdateData", () => {
  let captured: ReturnType<typeof buildPromotionUpdateData>;
  beforeEach(() => {
    captured = buildPromotionUpdateData(toSemester);
  });
  it("maps target semester fields", () => {
    expect(captured.currentSemester).toBe(2);
    expect(captured.semesterNumber).toBe(2);
    expect(captured.semesterId).toBe("sem-2");
    expect(captured.academicTermId).toBe("term-2");
    expect(captured.academicTermYear).toBe("2026");
  });
  it("builds a title-cased term label", () => {
    expect(captured.academicTermLabel).toBe("Even 2026");
  });
});
