import { Prisma } from "@webcampus/db";
import { beforeEach, describe, expect, test } from "bun:test";
import { ProjectMappingService } from "../project-mapping.service";

type MockBatch = {
  id: string;
  courseId: string;
  name: string;
  sortOrder: number;
  sectionId: string | null;
  _count: {
    studentAssignments: number;
    attendances: number;
    attendanceRecords: number;
    classSessions: number;
  };
  facultyAssignment: { id: string } | null;
};

type MockCourse = {
  id: string;
  semesterNumber: number;
  cycle: string;
  projectGroupingScope: "WITHIN_SECTION" | "DEPARTMENT_WIDE";
  nextProjectGroupSequence: number;
  numberOfBatches: number | null;
  electiveMappingVersion: number;
  semester?: { academicTerm: { year: string } };
};

let batches: MockBatch[];
let course: MockCourse;
let sections: { id: string; name: string }[];
let sectionPopulations: Record<string, number>;
let courseUpdates: {
  numberOfBatches?: number | null;
  nextProjectGroupSequence?: number;
  electiveMappingVersion?: { increment: number };
}[];

let nextId = 0;

const mkBatch = (
  courseId: string,
  name: string,
  sortOrder: number,
  sectionId: string | null = null
): MockBatch => ({
  id: `batch-${courseId}-${nextId++}`,
  courseId,
  name,
  sortOrder,
  sectionId,
  _count: {
    studentAssignments: 0,
    attendances: 0,
    attendanceRecords: 0,
    classSessions: 0,
  },
  facultyAssignment: null,
});

const withStudents = (batch: MockBatch, n: number): MockBatch => ({
  ...batch,
  _count: { ...batch._count, studentAssignments: n },
});

const withFaculty = (batch: MockBatch): MockBatch => ({
  ...batch,
  facultyAssignment: { id: "f1" },
});

const makeTx = (): Prisma.TransactionClient => {
  const tx = {
    $queryRaw: async () => [] as unknown[],
    course: {
      findUnique: async ({
        where,
      }: {
        where: { id: string };
      }): Promise<MockCourse | null> => {
        if (course.id !== where.id) return null;
        return {
          ...course,
          semester: { academicTerm: { year: "2026" } },
        } as MockCourse;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          numberOfBatches: number;
          nextProjectGroupSequence: number;
          electiveMappingVersion?: { increment: number };
        };
      }): Promise<unknown> => {
        if (course.id !== where.id) throw new Error("course not found");
        courseUpdates.push({
          numberOfBatches: data.numberOfBatches,
          nextProjectGroupSequence: data.nextProjectGroupSequence,
          electiveMappingVersion: data.electiveMappingVersion,
        });
        return { id: where.id };
      },
    },
    electiveBatch: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { courseId: string };
        orderBy?: { sortOrder: "asc" | "desc" };
      }): Promise<MockBatch[]> => {
        let rows = batches.filter((b) => b.courseId === where.courseId);
        if (orderBy?.sortOrder === "asc") {
          rows = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
        }
        return rows;
      },
      create: async ({
        data,
      }: {
        data: {
          courseId: string;
          name: string;
          sortOrder: number;
          sectionId: string | null;
        };
      }): Promise<MockBatch> => {
        const row = mkBatch(
          data.courseId,
          data.name,
          data.sortOrder,
          data.sectionId
        );
        batches.push(row);
        return row;
      },
      deleteMany: async ({
        where,
      }: {
        where: { id: { in: string[] }; courseId: string };
      }): Promise<{ count: number }> => {
        const before = batches.length;
        batches = batches.filter(
          (b) => !(b.courseId === where.courseId && where.id.in.includes(b.id))
        );
        return { count: before - batches.length };
      },
    },
    section: {
      findMany: async (): Promise<{ id: string; name: string }[]> => sections,
    },
    studentSection: {
      count: async ({
        where,
      }: {
        where: { sectionId: string };
      }): Promise<number> => sectionPopulations[where.sectionId] ?? 0,
    },
    electiveBatchFaculty: {
      deleteMany: async (): Promise<{ count: number }> => ({ count: 0 }),
    },
    electiveStudentAssignment: {
      deleteMany: async (): Promise<{ count: number }> => ({ count: 0 }),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
};

const runSync = (
  scope: "WITHIN_SECTION" | "DEPARTMENT_WIDE",
  groups: number | null
) =>
  ProjectMappingService.syncProjectGroups({
    tx: makeTx(),
    courseId: course.id,
    studentsPerGroup: 5,
    groupingScope: scope,
    targetGroupCount: groups,
  });

describe("ProjectMappingService.syncProjectGroups", () => {
  beforeEach(() => {
    batches = [];
    sections = [];
    sectionPopulations = {};
    courseUpdates = [];
    nextId = 0;
    course = {
      id: "c1",
      semesterNumber: 8,
      cycle: "NONE",
      projectGroupingScope: "WITHIN_SECTION",
      nextProjectGroupSequence: 0,
      numberOfBatches: null,
      electiveMappingVersion: 1,
    };
  });

  test("department-wide: creates G-001..G-00N and stores numberOfBatches + sequence", async () => {
    await runSync("DEPARTMENT_WIDE", 100);

    const names = batches.map((b) => b.name);
    expect(names[0]).toBe("G-001");
    expect(names[names.length - 1]).toBe("G-100");
    expect(batches.every((b) => b.sectionId === null)).toBe(true);
    expect(batches.map((b) => b.sortOrder)).toEqual(
      Array.from({ length: 100 }, (_, i) => i + 1)
    );
    expect(courseUpdates).toEqual([
      {
        numberOfBatches: 100,
        nextProjectGroupSequence: 100,
        electiveMappingVersion: { increment: 1 },
      },
    ]);
  });

  test("department-wide: increase appends from the persisted next sequence (G-101..)", async () => {
    course.nextProjectGroupSequence = 0;
    await runSync("DEPARTMENT_WIDE", 100); // G-001..G-100, seq -> 100
    course.nextProjectGroupSequence = 100; // simulate persisted counter
    await runSync("DEPARTMENT_WIDE", 120);

    expect(batches.map((b) => b.name).slice(100)).toEqual([
      "G-101",
      "G-102",
      "G-103",
      "G-104",
      "G-105",
      "G-106",
      "G-107",
      "G-108",
      "G-109",
      "G-110",
      "G-111",
      "G-112",
      "G-113",
      "G-114",
      "G-115",
      "G-116",
      "G-117",
      "G-118",
      "G-119",
      "G-120",
    ]);
    expect(batches).toHaveLength(120);
    expect(courseUpdates[courseUpdates.length - 1]?.numberOfBatches).toBe(120);
    expect(
      courseUpdates[courseUpdates.length - 1]?.nextProjectGroupSequence
    ).toBe(120);
  });

  test("within-section: derives per-section counts (ceil population / studentsPerGroup, min 1) and binds sectionId", async () => {
    sections = [
      { id: "s-a", name: "A" },
      { id: "s-b", name: "B" },
    ];
    sectionPopulations = { "s-a": 23, "s-b": 4 };
    await runSync("WITHIN_SECTION", null);

    // ceil(23/5)=5 groups for A, max(1, ceil(4/5))=1 for B.
    const aGroups = batches.filter((b) => b.sectionId === "s-a");
    const bGroups = batches.filter((b) => b.sectionId === "s-b");
    expect(aGroups).toHaveLength(5);
    expect(bGroups).toHaveLength(1);
    expect(aGroups.map((b) => b.name)).toEqual([
      "G-001",
      "G-002",
      "G-003",
      "G-004",
      "G-005",
    ]);
    expect(bGroups.map((b) => b.name)).toEqual(["G-006"]);
    expect(courseUpdates[0]?.numberOfBatches).toBe(6);
  });

  test("within-section: recompute does not reuse identifiers when count grows", async () => {
    sections = [{ id: "s-a", name: "A" }];
    sectionPopulations = { "s-a": 23 };
    await runSync("WITHIN_SECTION", null); // 5 groups G-001..G-005, seq=5

    sectionPopulations = { "s-a": 28 };
    await runSync("WITHIN_SECTION", null); // ceil(28/5)=6 groups

    expect(batches).toHaveLength(6);
    expect(batches[5]?.name).toBe("G-006");
    expect(new Set(batches.map((b) => b.name)).size).toBe(6);
  });

  test("decrease removes only removable groups (empty, unmapped, no history); occupied remain", async () => {
    course.nextProjectGroupSequence = 4;
    batches = [
      mkBatch("c1", "G-001", 1),
      mkBatch("c1", "G-002", 2),
      mkBatch("c1", "G-003", 3),
      mkBatch("c1", "G-004", 4),
    ];
    // G-002 has students; G-003 has faculty → must survive a shrink to 2.
    batches[1] = withStudents(batches[1] ?? batches[0]!, 5);
    batches[2] = withFaculty(batches[2] ?? batches[0]!);

    await runSync("DEPARTMENT_WIDE", 2);

    const names = batches.map((b) => b.name).sort();
    expect(names).toEqual(["G-002", "G-003"]);
    expect(courseUpdates[0]?.numberOfBatches).toBe(2);
  });

  test("decrease to fewer than the number of occupied groups is rejected", async () => {
    batches = [
      mkBatch("c1", "G-001", 1),
      mkBatch("c1", "G-002", 2),
      mkBatch("c1", "G-003", 3),
    ];
    batches[0] = withStudents(batches[0] ?? batches[0]!, 5);
    batches[1] = withStudents(batches[1] ?? batches[0]!, 5);
    batches[2] = withStudents(batches[2] ?? batches[0]!, 5);

    await expect(runSync("DEPARTMENT_WIDE", 1)).rejects.toThrow(
      "Cannot reduce project groups"
    );
    expect(batches).toHaveLength(3);
    expect(courseUpdates).toEqual([]);
  });

  test("regrow after a decrease never reuses previously used identifiers", async () => {
    course.nextProjectGroupSequence = 0;
    await runSync("DEPARTMENT_WIDE", 100); // G-001..G-100, seq -> 100
    course.nextProjectGroupSequence = 100;
    await runSync("DEPARTMENT_WIDE", 80); // removes 20 removable, keeps G-001..G-080
    expect(batches).toHaveLength(80);
    expect(batches.map((b) => b.name)[0]).toBe("G-001");
    expect(courseUpdates[1]?.nextProjectGroupSequence).toBe(100);

    course.nextProjectGroupSequence = 100;
    await runSync("DEPARTMENT_WIDE", 90);
    const names = batches.map((b) => b.name);
    expect(names).toHaveLength(90);
    expect(names).not.toContain("G-081");
    expect(names).not.toContain("G-091");
    expect(names.slice(80)).toEqual([
      "G-101",
      "G-102",
      "G-103",
      "G-104",
      "G-105",
      "G-106",
      "G-107",
      "G-108",
      "G-109",
      "G-110",
    ]);
  });

  test("scope change with occupied groups is rejected (orphans must be removable)", async () => {
    batches = [
      mkBatch("c1", "G-001", 1, "s-a"),
      mkBatch("c1", "G-002", 2, "s-a"),
    ];
    batches[0] = withStudents(batches[0] ?? batches[0]!, 3);

    await expect(runSync("DEPARTMENT_WIDE", 3)).rejects.toThrow(
      "Cannot change grouping configuration"
    );
    expect(batches).toHaveLength(2);
  });

  test("scope change with all-removable groups removes orphans and creates new buckets", async () => {
    batches = [
      mkBatch("c1", "G-001", 1, "s-a"),
      mkBatch("c1", "G-002", 2, "s-a"),
    ];
    await runSync("DEPARTMENT_WIDE", 3);

    expect(batches).toHaveLength(3);
    expect(batches.every((b) => b.sectionId === null)).toBe(true);
    expect(batches.map((b) => b.name)).toEqual(["G-003", "G-004", "G-005"]);
  });

  test("empty target (no sections / zero groups) keeps course but sets numberOfBatches 0", async () => {
    await runSync("WITHIN_SECTION", null);
    expect(batches).toHaveLength(0);
    expect(courseUpdates).toEqual([
      {
        numberOfBatches: 0,
        nextProjectGroupSequence: 0,
      },
    ]);
  });
});
