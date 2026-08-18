import { Prisma } from "@webcampus/db";
import { beforeEach, describe, expect, test } from "bun:test";
import { syncBatchManagedCourseBatches } from "../pe-capacity.service";

type MockBatch = {
  id: string;
  courseId: string;
  name: string;
  sortOrder: number;
};

let batches: MockBatch[];
let courseUpdates: { id: string; numberOfBatches: number }[];

let nextId = 0;

const mkBatch = (
  courseId: string,
  name: string,
  sortOrder: number
): MockBatch => ({
  id: `batch-${courseId}-${nextId++}`,
  courseId,
  name,
  sortOrder,
});

const makeTx = (): Prisma.TransactionClient => {
  const tx = {
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
      count: async ({
        where,
      }: {
        where: { id?: { in: string[] }; courseId: string };
      }): Promise<number> => {
        return batches.filter(
          (b) =>
            b.courseId === where.courseId &&
            (!where.id || where.id.in?.includes(b.id))
        ).length;
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
      create: async ({
        data,
      }: {
        data: { courseId: string; name: string; sortOrder: number };
      }): Promise<MockBatch> => {
        const row = mkBatch(data.courseId, data.name, data.sortOrder);
        batches.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { sortOrder: number; name?: string };
      }): Promise<MockBatch> => {
        const idx = batches.findIndex((b) => b.id === where.id);
        if (idx < 0) throw new Error("batch not found");
        const current = batches[idx];
        if (!current) throw new Error("batch not found");
        const updated = { ...current, ...data };
        batches[idx] = updated;
        return updated;
      },
    },
    electiveBatchFaculty: {
      deleteMany: async ({
        where,
      }: {
        where: { electiveBatchId: { in: string[] }; courseId: string };
      }): Promise<{ count: number }> => {
        return { count: where.electiveBatchId.in.length };
      },
    },
    electiveStudentAssignment: {
      deleteMany: async ({
        where,
      }: {
        where: { electiveBatchId: { in: string[] }; courseId: string };
      }): Promise<{ count: number }> => {
        return { count: where.electiveBatchId.in.length };
      },
    },
    course: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { numberOfBatches: number };
      }): Promise<unknown> => {
        courseUpdates.push({
          id: where.id,
          numberOfBatches: data.numberOfBatches,
        });
        return { id: where.id };
      },
    },
  };
  return tx as unknown as Prisma.TransactionClient;
};

describe("syncBatchManagedCourseBatches", () => {
  beforeEach(() => {
    batches = [];
    courseUpdates = [];
    nextId = 0;
  });

  test("increase appends batches numbered from max(sortOrder) + 1", async () => {
    batches = [mkBatch("c1", "CS101 1", 1), mkBatch("c1", "CS101 2", 2)];
    const tx = makeTx();
    await syncBatchManagedCourseBatches({
      tx,
      courseId: "c1",
      courseCode: "CS101",
      targetCount: 4,
    });

    const names = batches.map((b) => b.name);
    expect(names).toEqual(["CS101 1", "CS101 2", "CS101 3", "CS101 4"]);
    expect(batches.map((b) => b.sortOrder)).toEqual([1, 2, 3, 4]);
    expect(courseUpdates).toEqual([{ id: "c1", numberOfBatches: 4 }]);
  });

  test("decrease without explicit ids removes the last N batches", async () => {
    batches = [
      mkBatch("c1", "CS101 1", 1),
      mkBatch("c1", "CS101 2", 2),
      mkBatch("c1", "CS101 3", 3),
    ];
    const tx = makeTx();
    await syncBatchManagedCourseBatches({
      tx,
      courseId: "c1",
      courseCode: "CS101",
      targetCount: 2,
    });

    expect(batches.map((b) => b.name)).toEqual(["CS101 1", "CS101 2"]);
    expect(batches.map((b) => b.sortOrder)).toEqual([1, 2]);
    expect(courseUpdates).toEqual([{ id: "c1", numberOfBatches: 2 }]);
  });

  test("decrease with explicit ids removes exactly those batches, renumbers survivors and realigns names", async () => {
    batches = [
      mkBatch("c1", "CS101 1", 1),
      mkBatch("c1", "CS101 2", 2),
      mkBatch("c1", "CS101 3", 3),
    ];
    const middleId = batches[1]?.id ?? "";
    const tx = makeTx();
    await syncBatchManagedCourseBatches({
      tx,
      courseId: "c1",
      courseCode: "CS101",
      targetCount: 2,
      batchesToRemoveIds: [middleId],
    });

    const remaining = batches.filter((b) => b.courseId === "c1");
    expect(remaining.map((b) => b.name)).toEqual(["CS101 1", "CS101 2"]);
    expect(remaining.map((b) => b.sortOrder)).toEqual([1, 2]);
    expect(courseUpdates).toEqual([{ id: "c1", numberOfBatches: 2 }]);
  });

  test("rejects a batch id that belongs to another course and deletes nothing", async () => {
    batches = [
      mkBatch("c1", "CS101 1", 1),
      mkBatch("c1", "CS101 2", 2),
      mkBatch("other", "EE101 1", 1),
    ];
    const foreignId = batches.find((b) => b.courseId === "other")?.id ?? "";
    const tx = makeTx();
    await expect(
      syncBatchManagedCourseBatches({
        tx,
        courseId: "c1",
        courseCode: "CS101",
        targetCount: 1,
        batchesToRemoveIds: [foreignId],
      })
    ).rejects.toThrow("do not belong to this course");

    expect(batches.filter((b) => b.courseId === "c1")).toHaveLength(2);
    expect(batches.filter((b) => b.courseId === "other")).toHaveLength(1);
    expect(courseUpdates).toEqual([]);
  });

  test("throws when the remove list length does not match the decrease count", async () => {
    batches = [
      mkBatch("c1", "CS101 1", 1),
      mkBatch("c1", "CS101 2", 2),
      mkBatch("c1", "CS101 3", 3),
    ];
    const tx = makeTx();
    await expect(
      syncBatchManagedCourseBatches({
        tx,
        courseId: "c1",
        courseCode: "CS101",
        targetCount: 2,
        batchesToRemoveIds: [],
      })
    ).rejects.toThrow("you must select which batches to remove");
  });

  test("regrow after a mid-list delete realigns names so max+1 is free", async () => {
    batches = [
      mkBatch("c1", "CS101 1", 1),
      mkBatch("c1", "CS101 2", 2),
      mkBatch("c1", "CS101 3", 3),
    ];
    const middleId = batches[1]?.id ?? "";

    let tx = makeTx();
    await syncBatchManagedCourseBatches({
      tx,
      courseId: "c1",
      courseCode: "CS101",
      targetCount: 2,
      batchesToRemoveIds: [middleId],
    });
    // Survivors are realigned to CS101 1 / CS101 2 (sortOrder 1..2).
    expect(
      batches.filter((b) => b.courseId === "c1").map((b) => b.name)
    ).toEqual(["CS101 1", "CS101 2"]);

    tx = makeTx();
    await syncBatchManagedCourseBatches({
      tx,
      courseId: "c1",
      courseCode: "CS101",
      targetCount: 3,
    });

    const names = batches.filter((b) => b.courseId === "c1").map((b) => b.name);
    expect(names).toEqual(["CS101 1", "CS101 2", "CS101 3"]);
    expect(new Set(names).size).toBe(3);
    expect(
      batches.filter((b) => b.courseId === "c1").map((b) => b.sortOrder)
    ).toEqual([1, 2, 3]);
  });

  test("preserves names that were admin-renamed (non-prefix) during realignment", async () => {
    batches = [
      mkBatch("c1", "CS101 1", 1),
      mkBatch("c1", "Special Batch", 2),
      mkBatch("c1", "CS101 3", 3),
    ];
    const lastId = batches[2]?.id ?? "";
    const tx = makeTx();
    await syncBatchManagedCourseBatches({
      tx,
      courseId: "c1",
      courseCode: "CS101",
      targetCount: 2,
      batchesToRemoveIds: [lastId],
    });

    const remaining = batches.filter((b) => b.courseId === "c1");
    // "Special Batch" is untouched; it now takes sortOrder 2 after renumber.
    expect(remaining.map((b) => b.name)).toEqual(["CS101 1", "Special Batch"]);
    expect(remaining.map((b) => b.sortOrder)).toEqual([1, 2]);
  });
});
