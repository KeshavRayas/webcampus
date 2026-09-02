/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { PINNED_REGISTRATION_TYPES } from "../course-registration-resolver";
import { buildRegistrationWhere } from "../registration-helper.service";

describe("buildRegistrationWhere", () => {
  const base = {
    courseId: "course-1",
    semesterId: "sem-1",
  };

  it("restricts to ACTIVE pinned-type registrations (K2 roster union)", () => {
    const where = buildRegistrationWhere(base);
    expect(where.status).toBe("ACTIVE");
    expect(where.registrationType).toEqual({
      in: [...PINNED_REGISTRATION_TYPES],
    });
    expect(where.courseId).toBe(base.courseId);
    expect(where.semesterId).toBe(base.semesterId);
  });

  it("is not term-anchored so cross-term re-registration rows resolve", () => {
    const where = buildRegistrationWhere(base);
    expect(where).not.toHaveProperty("academicTermId");
  });

  it("scopes to the section through student section membership", () => {
    const where = buildRegistrationWhere({ ...base, sectionId: "sec-1" });
    expect(where.student).toEqual({
      studentSections: { some: { sectionId: "sec-1" } },
    });
  });

  it("scopes lab rosters through student batch membership", () => {
    const where = buildRegistrationWhere({ ...base, batchId: "batch-1" });
    expect(where.student).toEqual({
      batches: { some: { id: "batch-1" } },
    });
  });

  it("composes section and batch membership together", () => {
    const where = buildRegistrationWhere({
      ...base,
      sectionId: "sec-1",
      batchId: "batch-1",
    });
    expect(where.student).toEqual({
      studentSections: { some: { sectionId: "sec-1" } },
      batches: { some: { id: "batch-1" } },
    });
  });

  it("omits the student filter without a section or batch", () => {
    const where = buildRegistrationWhere(base);
    expect(where.student).toBeUndefined();
  });
});
