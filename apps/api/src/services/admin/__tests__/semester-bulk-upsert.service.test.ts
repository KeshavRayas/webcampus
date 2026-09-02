/// <reference types="bun" />
import { SemesterService } from "@webcampus/api/src/services/admin/semester.service";
import { beforeEach, describe, expect, it, mock } from "bun:test";

const dbMock: Record<string, unknown> = {};

mock.module("@webcampus/db", () => ({ db: dbMock, Prisma: {} }));
mock.module("@webcampus/common/logger", () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

const termId = "11111111-1111-1111-1111-111111111111";
const userId = "22222222-2222-2222-2222-222222222222";

function makeItem(semesterNumber: number) {
  return {
    academicTermId: termId,
    programType: "UG" as const,
    semesterNumber,
    termType: "supplementary" as const,
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-07-01"),
  };
}

describe("bulkUpsertSemesters parity guard", () => {
  beforeEach(() => {
    dbMock.user = {
      findUnique: async () => ({ id: userId }),
    };
    dbMock.academicTerm = {
      findUnique: async () => ({
        type: "supplementary",
        parity: "odd",
        year: "2026",
      }),
    };
    dbMock.semester = { upsert: async () => ({ id: "upserted" }) };
    dbMock.$transaction = async () => [];
  });

  it("propagates the specific parity-mismatch message (not masked)", async () => {
    await expect(
      SemesterService.bulkUpsertSemesters(termId, userId, [makeItem(2)])
    ).rejects.toThrow("hosts odd-numbered semesters only");
  });

  it("accepts matching-parity semesters", async () => {
    let upserts = 0;
    dbMock.semester = {
      upsert: async () => {
        upserts += 1;
        return { id: `u${upserts}` };
      },
    };
    const res = await SemesterService.bulkUpsertSemesters(termId, userId, [
      makeItem(1),
      makeItem(3),
    ]);
    expect(res.status).toBe("success");
    expect(upserts).toBe(2);
  });

  it("uses the authenticated user id instead of a payload user id", async () => {
    let capturedData: Record<string, unknown> | undefined;
    dbMock.semester = {
      upsert: async (args: {
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        capturedData = args.create;
        return { id: "upserted" };
      },
    };

    const payload = {
      ...makeItem(1),
      userId: "forged-user-id",
    } as never;
    await SemesterService.bulkUpsertSemesters(termId, userId, [payload]);

    expect(capturedData?.userId).toBe(userId);
  });

  it("rejects when the term does not exist", async () => {
    dbMock.academicTerm = { findUnique: async () => null };
    await expect(
      SemesterService.bulkUpsertSemesters(termId, userId, [makeItem(1)])
    ).rejects.toThrow("Academic Term not found");
  });

  it("rejects when the authenticated user no longer exists", async () => {
    dbMock.user = { findUnique: async () => null };

    await expect(
      SemesterService.bulkUpsertSemesters(termId, userId, [makeItem(1)])
    ).rejects.toThrow("Authenticated user not found");
  });

  it("skips the guard for legacy NULL-parity supplementary terms", async () => {
    dbMock.academicTerm = {
      findUnique: async () => ({
        type: "supplementary",
        parity: null,
        year: "2025",
      }),
    };
    const res = await SemesterService.bulkUpsertSemesters(termId, userId, [
      makeItem(2),
    ]);
    expect(res.status).toBe("success");
  });
});
