/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import {
  PINNED_REGISTRATION_TYPES,
  resolveActiveRegistration,
  type ResolvedActiveRegistration,
} from "../course-registration-resolver";

type FindFirstCapture = {
  where: Record<string, unknown>;
};

function fakeClient(returnValue: ResolvedActiveRegistration | null) {
  const captures: FindFirstCapture[] = [];
  const client = {
    courseRegistration: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        captures.push({ where: args.where });
        return returnValue;
      },
    },
  };
  return { client, captures };
}

function firstCapture(captures: FindFirstCapture[]): Record<string, unknown> {
  const capture = captures[0];
  if (!capture) throw new Error("expected at least one findFirst capture");
  return capture.where;
}

describe("resolveActiveRegistration", () => {
  it("restricts to pinned registration types and ACTIVE status", async () => {
    const { client, captures } = fakeClient(null);
    await resolveActiveRegistration(
      { studentId: "s1", courseId: "c1" },
      client as never
    );
    expect(captures).toHaveLength(1);
    expect(firstCapture(captures).status).toBe("ACTIVE");
    expect(firstCapture(captures).registrationType).toEqual({
      in: [...PINNED_REGISTRATION_TYPES],
    });
  });

  it("applies the academicTermId anchor when provided", async () => {
    const { client, captures } = fakeClient(null);
    await resolveActiveRegistration(
      { studentId: "s1", courseId: "c1", academicTermId: "t1" },
      client as never
    );
    expect(firstCapture(captures).academicTermId).toBe("t1");
  });

  it("applies the semesterId anchor when provided (course-home scoping)", async () => {
    const { client, captures } = fakeClient(null);
    await resolveActiveRegistration(
      { studentId: "s1", courseId: "c1", semesterId: "sem-1" },
      client as never
    );
    expect(firstCapture(captures).semesterId).toBe("sem-1");
  });

  it("applies both anchors together when provided", async () => {
    const { client, captures } = fakeClient(null);
    await resolveActiveRegistration(
      {
        studentId: "s1",
        courseId: "c1",
        academicTermId: "t1",
        semesterId: "sem-1",
      },
      client as never
    );
    expect(firstCapture(captures).academicTermId).toBe("t1");
    expect(firstCapture(captures).semesterId).toBe("sem-1");
  });

  it("omits the term filter without an anchor (recency fallback)", async () => {
    const { client, captures } = fakeClient(null);
    await resolveActiveRegistration(
      { studentId: "s1", courseId: "c1" },
      client as never
    );
    expect(firstCapture(captures)).not.toHaveProperty("academicTermId");
    expect(firstCapture(captures)).not.toHaveProperty("semesterId");
  });

  it("returns the resolved registration", async () => {
    const row: ResolvedActiveRegistration = {
      id: "reg-2",
      academicTermId: "t1",
      registrationType: "RE_REGISTRATION",
    };
    const { client } = fakeClient(row);
    const result = await resolveActiveRegistration(
      { studentId: "s1", courseId: "c1", academicTermId: "t1" },
      client as never
    );
    expect(result).toEqual(row);
  });

  it("returns null when no candidate matches", async () => {
    const { client } = fakeClient(null);
    const result = await resolveActiveRegistration(
      { studentId: "s1", courseId: "c1" },
      client as never
    );
    expect(result).toBeNull();
  });
});
