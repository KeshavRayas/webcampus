/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

const batchFindFirst = mock<() => Promise<{ id: string } | null>>(
  async () => null
);

mock.module("@webcampus/db", () => ({
  db: {
    electiveBatch: {
      findFirst: batchFindFirst,
    },
  },
  Prisma: {},
  CourseApprovalStatus: {
    DRAFT: "DRAFT",
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
}));

const { assertBatchBelongsToCourse } = await import("../batch-managed");

describe("assertBatchBelongsToCourse", () => {
  beforeEach(() => {
    batchFindFirst.mockImplementation(async () => null);
  });

  it("resolves when the batch belongs to the course", async () => {
    batchFindFirst.mockImplementation(async () => ({ id: "batch-1" }));

    await expect(
      assertBatchBelongsToCourse("course-1", "batch-1")
    ).resolves.toBeUndefined();
  });

  it("throws when the batch belongs to another course", async () => {
    await expect(
      assertBatchBelongsToCourse("course-1", "batch-999")
    ).rejects.toThrow("Selected batch does not belong to this course");
  });
});
