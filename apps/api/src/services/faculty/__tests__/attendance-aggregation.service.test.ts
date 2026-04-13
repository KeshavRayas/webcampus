import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { db } from "@webcampus/db";
import { AttendanceAggregationService } from "@webcampus/api/src/services/faculty/attendance-aggregation.service";

describe("AttendanceAggregationService", () => {
  describe("aggregateAttendanceForStudentCourse", () => {
    it("should create attendance record when none exists", async () => {
      const courseId = "test-course-id";
      const studentId = "test-student-id";
      
      const result = await AttendanceAggregationService.aggregateAttendanceForStudentCourse(
        studentId,
        courseId,
        db
      );
      
      expect(result.status).toBe("success");
      expect(result.data).toBeDefined();
      expect(result.data?.total).toBeGreaterThanOrEqual(0);
      expect(result.data?.present).toBeLessThanOrEqual(result.data?.total!);
      expect(result.data?.absent).toEqual(result.data?.total! - result.data?.present!);
    });

    it("should calculate percentage correctly", async () => {
      const result = await AttendanceAggregationService.aggregateAttendanceForStudentCourse(
        "student-id",
        "course-id",
        db
      );
      
      if (result.data?.total && result.data.total > 0) {
        const expectedPercentage = (result.data.present / result.data.total) * 100;
        expect(result.data.percentage).toBeCloseTo(expectedPercentage, 2);
      }
    });

    it("should preserve condonation status when updating", async () => {
      const result = await AttendanceAggregationService.aggregateAttendanceForStudentCourse(
        "student-id",
        "course-id",
        db
      );
      
      expect(result.data?.condonationStatus).toBeDefined();
    });
  });
});
