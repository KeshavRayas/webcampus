/// <reference types="bun" />

import { describe, expect, it, mock } from "bun:test";

mock.module("@webcampus/db", () => ({
  db: {},
  Prisma: {},
  CourseApprovalStatus: {
    DRAFT: "DRAFT",
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    NEEDS_REVISION: "NEEDS_REVISION",
  },
}));

const { assertExactlyOneFeedbackOwnership } = await import(
  "../feedback.service"
);

describe("assertExactlyOneFeedbackOwnership", () => {
  it("resolves when exactly courseAssignmentId is set", () => {
    expect(() =>
      assertExactlyOneFeedbackOwnership({ courseAssignmentId: "pc-1" })
    ).not.toThrow();
  });

  it("resolves when exactly electiveBatchFacultyId is set", () => {
    expect(() =>
      assertExactlyOneFeedbackOwnership({ electiveBatchFacultyId: "pe-1" })
    ).not.toThrow();
  });

  it("throws when both ownership keys are set", () => {
    expect(() =>
      assertExactlyOneFeedbackOwnership({
        courseAssignmentId: "pc-1",
        electiveBatchFacultyId: "pe-1",
      })
    ).toThrow(
      "Feedback must reference exactly one ownership path (courseAssignmentId XOR electiveBatchFacultyId)."
    );
  });

  it("throws when neither ownership key is set", () => {
    expect(() => assertExactlyOneFeedbackOwnership({})).toThrow(
      "Feedback must reference exactly one ownership path (courseAssignmentId XOR electiveBatchFacultyId)."
    );
  });

  it("throws when both keys are null", () => {
    expect(() =>
      assertExactlyOneFeedbackOwnership({
        courseAssignmentId: null,
        electiveBatchFacultyId: null,
      })
    ).toThrow(
      "Feedback must reference exactly one ownership path (courseAssignmentId XOR electiveBatchFacultyId)."
    );
  });

  it("resolves when courseAssignmentId is null and electiveBatchFacultyId is set", () => {
    expect(() =>
      assertExactlyOneFeedbackOwnership({
        courseAssignmentId: null,
        electiveBatchFacultyId: "pe-1",
      })
    ).not.toThrow();
  });
});
