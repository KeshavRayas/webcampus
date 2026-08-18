/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import {
  FacultyAttendanceDetailedReportQuerySchema,
  FacultyAttendanceSessionStudentsQuerySchema,
} from "../attendance.schema";

const UUID = "00000000-0000-4000-8000-000000000001";
const UUID2 = "00000000-0000-4000-8000-000000000002";

describe("FacultyAttendanceSessionStudentsQuerySchema", () => {
  it("accepts courseId + sectionId (section-based domain)", () => {
    const result = FacultyAttendanceSessionStudentsQuerySchema.safeParse({
      courseId: UUID,
      sectionId: UUID2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts courseId + electiveBatchId (elective domain)", () => {
    const result = FacultyAttendanceSessionStudentsQuerySchema.safeParse({
      courseId: UUID,
      electiveBatchId: UUID2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects sectionId + electiveBatchId together (cross-domain ambiguity)", () => {
    const result = FacultyAttendanceSessionStudentsQuerySchema.safeParse({
      courseId: UUID,
      sectionId: UUID2,
      electiveBatchId: UUID2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing courseId", () => {
    const result = FacultyAttendanceSessionStudentsQuerySchema.safeParse({
      sectionId: UUID2,
    });
    expect(result.success).toBe(false);
  });
});

describe("FacultyAttendanceDetailedReportQuerySchema", () => {
  it("accepts courseId + sectionId", () => {
    const result = FacultyAttendanceDetailedReportQuerySchema.safeParse({
      courseId: UUID,
      sectionId: UUID2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts courseId + electiveBatchId", () => {
    const result = FacultyAttendanceDetailedReportQuerySchema.safeParse({
      courseId: UUID,
      electiveBatchId: UUID2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts courseId + sectionId + batchId (lab section report)", () => {
    const result = FacultyAttendanceDetailedReportQuerySchema.safeParse({
      courseId: UUID,
      sectionId: UUID2,
      batchId: UUID2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects neither sectionId nor electiveBatchId", () => {
    const result = FacultyAttendanceDetailedReportQuerySchema.safeParse({
      courseId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects sectionId + electiveBatchId together", () => {
    const result = FacultyAttendanceDetailedReportQuerySchema.safeParse({
      courseId: UUID,
      sectionId: UUID2,
      electiveBatchId: UUID2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects batchId + electiveBatchId together (zero-sessions footgun)", () => {
    const result = FacultyAttendanceDetailedReportQuerySchema.safeParse({
      courseId: UUID,
      batchId: UUID2,
      electiveBatchId: UUID2,
    });
    expect(result.success).toBe(false);
  });
});
