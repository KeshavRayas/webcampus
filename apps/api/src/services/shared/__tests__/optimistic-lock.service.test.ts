import { Prisma } from "@webcampus/db";
import { describe, expect, mock, test } from "bun:test";
import {
  checkAndIncrementElectiveMappingVersion,
  OptimisticLockError,
} from "../audit.service";

// Mutable state referenced by the db mock closures.
let currentVersion = 3;

const dbMock = {
  course: {
    updateMany: async ({
      where,
    }: {
      where: { id: string; electiveMappingVersion: number };
    }): Promise<{ count: number }> => {
      return { count: where.electiveMappingVersion === currentVersion ? 1 : 0 };
    },
    findUnique: async (): Promise<{ electiveMappingVersion: number }> => ({
      electiveMappingVersion: currentVersion,
    }),
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {},
}));

describe("checkAndIncrementElectiveMappingVersion", () => {
  test("increments the version when the client version matches", async () => {
    currentVersion = 3;

    const result = await checkAndIncrementElectiveMappingVersion("course-1", 3);

    expect(result).toBe(4);
  });

  test("throws OptimisticLockError carrying the current version when stale", async () => {
    currentVersion = 5;

    let err: unknown;
    try {
      await checkAndIncrementElectiveMappingVersion("course-1", 3);
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(OptimisticLockError);
    const lockErr = err as OptimisticLockError;
    expect(lockErr.statusCode).toBe(409);
    expect(lockErr.currentVersion).toBe(5);
  });

  test("uses the provided tx client instead of db", async () => {
    let usedTx = false;
    const tx = {
      course: {
        updateMany: async (): Promise<{ count: number }> => {
          usedTx = true;
          return { count: 1 };
        },
        findUnique: async (): Promise<{ electiveMappingVersion: number }> => ({
          electiveMappingVersion: 2,
        }),
      },
    };

    const result = await checkAndIncrementElectiveMappingVersion(
      "course-1",
      2,
      tx as unknown as Prisma.TransactionClient
    );

    expect(result).toBe(3);
    expect(usedTx).toBe(true);
  });
});
