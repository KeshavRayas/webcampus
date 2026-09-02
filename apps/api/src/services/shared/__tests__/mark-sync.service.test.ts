/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { recomputeStudentMark } from "../mark-sync.service";

type MarkWrite = { kind: string; args: Record<string, unknown> };

function firstWrite(writes: MarkWrite[]): MarkWrite {
  const write = writes[0];
  if (!write) throw new Error("expected at least one mark write");
  return write;
}

function fakeTx(options: {
  pinnedRow: { id: string } | null;
  createError?: unknown;
}) {
  const writes: MarkWrite[] = [];
  const client = {
    course: {
      findUnique: async () => ({ cieEligibility: 35, code: "CS101" }),
    },
    assessmentTemplate: {
      findMany: async () => [],
    },
    semester: {
      findMany: async () => [],
    },
    studentAssessment: {
      findMany: async () => [],
    },
    mark: {
      findFirst: async () => options.pinnedRow,
      update: async (args: Record<string, unknown>) => {
        writes.push({ kind: "update", args });
        return {};
      },
      create: async (args: Record<string, unknown>) => {
        if (options.createError) throw options.createError;
        writes.push({ kind: "create", args });
        return {};
      },
      upsert: async (args: Record<string, unknown>) => {
        writes.push({ kind: "upsert", args });
        return {};
      },
    },
  };
  return { client, writes };
}

describe("recomputeStudentMark attempt isolation", () => {
  it("updates only the pinned attempt's row and never touches pin fields", async () => {
    const { client, writes } = fakeTx({ pinnedRow: { id: "mark-1" } });
    await recomputeStudentMark("s1", "c1", client as never, {
      courseRegistrationId: "reg-1",
      semesterId: "sem-1",
    });
    expect(writes).toHaveLength(1);
    expect(firstWrite(writes).kind).toBe("update");
    const data = (firstWrite(writes).args as { data: Record<string, unknown> })
      .data;
    expect(Object.keys(data).sort()).toEqual(["cieTotal", "status"]);
    const where = firstWrite(writes).args.where;
    expect(where).toEqual({ id: "mark-1" });
  });

  it("creates a new row for a second attempt with the registration pinned", async () => {
    const { client, writes } = fakeTx({ pinnedRow: null });
    await recomputeStudentMark("s1", "c1", client as never, {
      courseRegistrationId: "reg-2",
    });
    expect(writes).toHaveLength(1);
    expect(firstWrite(writes).kind).toBe("create");
    const data = (firstWrite(writes).args as { data: Record<string, unknown> })
      .data;
    expect(data.courseRegistrationId).toBe("reg-2");
    expect(data.studentId).toBe("s1");
    expect(data.courseId).toBe("c1");
    expect(data).toHaveProperty("cieTotal");
    expect(data).toHaveProperty("status");
  });

  it("survives the transitional legacy unique conflict without clobbering the old attempt", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    const { client, writes } = fakeTx({
      pinnedRow: null,
      createError: p2002,
    });
    await recomputeStudentMark("s1", "c1", client as never, {
      courseRegistrationId: "reg-2",
    });
    expect(writes).toHaveLength(0);
  });

  it("creates an unpinned legacy row when no attempt context is given", async () => {
    const { client, writes } = fakeTx({ pinnedRow: null });
    await recomputeStudentMark("s1", "c1", client as never);
    expect(writes).toHaveLength(1);
    expect(firstWrite(writes).kind).toBe("create");
    const data = (firstWrite(writes).args as { data: Record<string, unknown> })
      .data;
    expect(data.studentId).toBe("s1");
    expect(data.courseId).toBe("c1");
    expect(data).not.toHaveProperty("courseRegistrationId");
  });

  it("scopes the unpinned lookup to rows without an attempt when no context is given", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const base = fakeTx({ pinnedRow: null });
    const client = {
      ...base.client,
      mark: {
        ...base.client.mark,
        findFirst: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return null;
        },
      },
    };
    await recomputeStudentMark("s1", "c1", client as never);
    expect(capturedWhere as Record<string, unknown> | null).toEqual({
      studentId: "s1",
      courseId: "c1",
      courseRegistrationId: null,
    });
  });

  it("scopes aggregation templates to the course-home semester when anchored", async () => {
    let templateWhere: Record<string, unknown> | null = null;
    const base = fakeTx({ pinnedRow: { id: "mark-1" } });
    const client = {
      ...base.client,
      assessmentTemplate: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          templateWhere = args.where;
          return [];
        },
      },
    };
    await recomputeStudentMark("s1", "c1", client as never, {
      courseRegistrationId: "reg-1",
      semesterId: "sem-9",
    });
    expect(templateWhere).not.toBeNull();
    const where = templateWhere as unknown as Record<string, unknown>;
    expect(where.semesterId).toBe("sem-9");
  });
});
