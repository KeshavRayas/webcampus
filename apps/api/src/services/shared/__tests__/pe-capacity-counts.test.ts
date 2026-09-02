/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { PINNED_REGISTRATION_TYPES } from "../course-registration-resolver";

const peCapacityModule = "../pe-capacity.service";
const { PeCapacityService } = await import(`${peCapacityModule}?direct`);

type CountCapture = {
  model: string;
  where: Record<string, unknown>;
};

type FindManyCapture = {
  model: string;
  where: Record<string, unknown>;
};

function fakeClient(options: {
  registeredCount?: number;
  registrations?: { studentId: string }[];
  assignedCount?: number;
}) {
  const countCaptures: CountCapture[] = [];
  const findManyCaptures: FindManyCapture[] = [];
  const client = {
    courseRegistration: {
      count: async (args: { where: Record<string, unknown> }) => {
        countCaptures.push({
          model: "courseRegistration",
          where: args.where,
        });
        return options.registeredCount ?? 0;
      },
      findMany: async (args: { where: Record<string, unknown> }) => {
        findManyCaptures.push({
          model: "courseRegistration",
          where: args.where,
        });
        return options.registrations ?? [];
      },
    },
    electiveStudentAssignment: {
      count: async () => options.assignedCount ?? 0,
    },
  };
  return { client, countCaptures, findManyCaptures };
}

function firstWhere(
  captures: Array<{ where: Record<string, unknown> }>
): Record<string, unknown> {
  const capture = captures[0];
  if (!capture) throw new Error("expected at least one captured query");
  return capture.where;
}

describe("PeCapacityService registration counts", () => {
  it("countRegisteredForCourse counts only ACTIVE pinned-type rows", async () => {
    const { client, countCaptures } = fakeClient({ registeredCount: 7 });
    const result = await PeCapacityService.countRegisteredForCourse(
      "course-1",
      client as never
    );
    expect(result).toBe(7);
    expect(firstWhere(countCaptures)).toEqual({
      courseId: "course-1",
      status: "ACTIVE",
      registrationType: { in: [...PINNED_REGISTRATION_TYPES] },
    });
  });

  it("countRegisteredInScope composes scope filters with ACTIVE pinned types", async () => {
    const { client, countCaptures } = fakeClient({ registeredCount: 12 });
    const result = await PeCapacityService.countRegisteredInScope(
      {
        departmentId: "dept-1",
        semesterId: "sem-1",
        cycle: null,
      },
      client as never
    );
    expect(result).toBe(12);
    expect(firstWhere(countCaptures)).toEqual({
      semesterId: "sem-1",
      status: "ACTIVE",
      registrationType: { in: [...PINNED_REGISTRATION_TYPES] },
      course: {
        courseType: "PE",
        departmentId: "dept-1",
      },
    });
  });
});

describe("PeCapacityService.isElectiveMappingComplete", () => {
  it("returns true without querying assignments when nothing is registered", async () => {
    const { client, findManyCaptures } = fakeClient({});
    const result = await PeCapacityService.isElectiveMappingComplete(
      "course-1",
      client as never
    );
    expect(result).toBe(true);
    expect(findManyCaptures).toHaveLength(1);
  });

  it("deduplicates re-registration chains to distinct students", async () => {
    const { client } = fakeClient({
      registrations: [
        { studentId: "s1" },
        { studentId: "s1" },
        { studentId: "s2" },
      ],
      assignedCount: 2,
    });
    const result = await PeCapacityService.isElectiveMappingComplete(
      "course-1",
      client as never
    );
    expect(result).toBe(true);
  });

  it("reports incomplete when assignments do not cover distinct registrants", async () => {
    const { client } = fakeClient({
      registrations: [{ studentId: "s1" }, { studentId: "s2" }],
      assignedCount: 1,
    });
    const result = await PeCapacityService.isElectiveMappingComplete(
      "course-1",
      client as never
    );
    expect(result).toBe(false);
  });

  it("restricts the mapping check to ACTIVE pinned-type rows", async () => {
    const { client, findManyCaptures } = fakeClient({});
    await PeCapacityService.isElectiveMappingComplete(
      "course-1",
      client as never
    );
    expect(firstWhere(findManyCaptures)).toEqual({
      courseId: "course-1",
      status: "ACTIVE",
      registrationType: { in: [...PINNED_REGISTRATION_TYPES] },
    });
  });
});
