/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

type AttendanceRecordRow = {
  studentId: string;
  courseId: string;
  status: "PRESENT" | "ABSENT";
};

type AttendanceRow = {
  id: string;
  studentId: string;
  courseId: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
  condonationStatus: string;
  batchId: string | null;
  electiveBatchId: string | null;
};

let attendanceRecords: AttendanceRecordRow[] = [];
const attendanceStore = new Map<string, AttendanceRow>();

const keyOf = (studentId: string, courseId: string): string => {
  return `${studentId}:${courseId}`;
};

const dbMock = {
  attendanceRecord: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count: async ({ where }: any) => {
      return attendanceRecords.filter((row) => {
        if (where.studentId && row.studentId !== where.studentId) {
          return false;
        }

        if (where.status && row.status !== where.status) {
          return false;
        }

        if (
          where.ClassSession?.courseId &&
          row.courseId !== where.ClassSession.courseId
        ) {
          return false;
        }

        return true;
      }).length;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: async ({ where, distinct }: any) => {
      const rows = attendanceRecords.filter((row) => {
        return (
          !where?.ClassSession?.courseId ||
          row.courseId === where.ClassSession.courseId
        );
      });

      if (distinct?.includes("studentId")) {
        const seen = new Set<string>();
        return rows
          .filter((row) => {
            if (seen.has(row.studentId)) {
              return false;
            }

            seen.add(row.studentId);
            return true;
          })
          .map((row) => ({ studentId: row.studentId }));
      }

      return rows;
    },
  },
  courseRegistration: {
    findFirst: async () => null,
  },
  attendance: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: async ({ where, distinct }: any) => {
      const rows = Array.from(attendanceStore.values()).filter((row) => {
        if (where?.studentId && row.studentId !== where.studentId) {
          return false;
        }

        if (where?.courseId && row.courseId !== where.courseId) {
          return false;
        }

        return true;
      });

      if (distinct?.includes("studentId")) {
        const seen = new Set<string>();
        return rows
          .filter((row) => {
            if (seen.has(row.studentId)) {
              return false;
            }

            seen.add(row.studentId);
            return true;
          })
          .map((row) => ({ studentId: row.studentId }));
      }

      return rows;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: async ({ where }: any) => {
      const row = Array.from(attendanceStore.values()).find(
        (entry) =>
          (!where?.studentId || entry.studentId === where.studentId) &&
          (!where?.courseId || entry.courseId === where.courseId) &&
          (!where?.batchId || entry.batchId === where.batchId) &&
          (!where?.electiveBatchId ||
            entry.electiveBatchId === where.electiveBatchId)
      );

      return row
        ? {
            id: row.id,
            condonationStatus: row.condonationStatus,
          }
        : null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: async ({ where }: any) => {
      const key = keyOf(
        where.studentId_courseId.studentId,
        where.studentId_courseId.courseId
      );
      const value = attendanceStore.get(key);

      return value
        ? {
            condonationStatus: value.condonationStatus,
          }
        : null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsert: async ({ where, create, update }: any) => {
      const key = keyOf(
        where.studentId_courseId.studentId,
        where.studentId_courseId.courseId
      );
      const existing = attendanceStore.get(key);

      if (!existing) {
        attendanceStore.set(key, {
          id: create.id ?? `${create.studentId}:${create.courseId}`,
          studentId: create.studentId,
          courseId: create.courseId,
          total: create.total,
          present: create.present,
          absent: create.absent,
          percentage: create.percentage,
          condonationStatus: create.condonationStatus,
          batchId: create.batchId ?? null,
          electiveBatchId: create.electiveBatchId ?? null,
        });
        return;
      }

      attendanceStore.set(key, {
        ...existing,
        total: update.total,
        present: update.present,
        absent: update.absent,
        percentage: update.percentage,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: async ({ where, data }: any) => {
      const key = where.id;
      const existing = attendanceStore.get(key);

      if (!existing) {
        return;
      }

      attendanceStore.set(key, {
        ...existing,
        total: data.total,
        present: data.present,
        absent: data.absent,
        percentage: data.percentage,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: async ({ data }: any) => {
      const key = keyOf(data.studentId, data.courseId);
      attendanceStore.set(key, {
        id: data.id ?? key,
        studentId: data.studentId,
        courseId: data.courseId,
        total: data.total,
        present: data.present,
        absent: data.absent,
        percentage: data.percentage,
        condonationStatus: data.condonationStatus,
        batchId: data.batchId ?? null,
        electiveBatchId: data.electiveBatchId ?? null,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteMany: async ({ where }: any) => {
      const key = keyOf(where.studentId, where.courseId);
      const deleted = attendanceStore.delete(key);
      return { count: deleted ? 1 : 0 };
    },
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
  },
}));

describe("AttendanceAggregationService", () => {
  beforeEach(() => {
    attendanceRecords = [];
    attendanceStore.clear();
  });

  it("aggregates a student-course pair and creates summary row", async () => {
    attendanceRecords = [
      { studentId: "student-1", courseId: "course-1", status: "PRESENT" },
      { studentId: "student-1", courseId: "course-1", status: "ABSENT" },
      { studentId: "student-1", courseId: "course-1", status: "PRESENT" },
      { studentId: "student-2", courseId: "course-1", status: "PRESENT" },
    ];

    const { AttendanceAggregationService } = await import(
      "@webcampus/api/src/services/faculty/attendance-aggregation.service"
    );

    const result =
      await AttendanceAggregationService.aggregateAttendanceForStudentCourse(
        "student-1",
        "course-1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dbMock as any
      );

    expect(result.status).toBe("success");
    if (result.status === "error" || !result.data) {
      throw new Error("Expected successful aggregation result");
    }

    expect(result.data.total).toBe(3);
    expect(result.data.present).toBe(2);
    expect(result.data.absent).toBe(1);
    expect(result.data.percentage).toBeCloseTo(66.6666, 3);

    const stored = attendanceStore.get("student-1:course-1");
    expect(stored).toBeDefined();
    expect(stored?.total).toBe(3);
    expect(stored?.present).toBe(2);
    expect(stored?.absent).toBe(1);
  });

  it("preserves condonationStatus while updating aggregates", async () => {
    attendanceStore.set("student-1:course-1", {
      id: "student-1:course-1",
      studentId: "student-1",
      courseId: "course-1",
      total: 1,
      present: 1,
      absent: 0,
      percentage: 100,
      condonationStatus: "APPROVED",
      batchId: null,
      electiveBatchId: null,
    });

    attendanceRecords = [
      { studentId: "student-1", courseId: "course-1", status: "PRESENT" },
      { studentId: "student-1", courseId: "course-1", status: "ABSENT" },
    ];

    const { AttendanceAggregationService } = await import(
      "@webcampus/api/src/services/faculty/attendance-aggregation.service"
    );

    const result =
      await AttendanceAggregationService.aggregateAttendanceForStudentCourse(
        "student-1",
        "course-1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dbMock as any
      );

    expect(result.status).toBe("success");
    const stored = attendanceStore.get("student-1:course-1");
    expect(stored?.condonationStatus).toBe("APPROVED");
    expect(stored?.total).toBe(2);
    expect(stored?.present).toBe(1);
    expect(stored?.absent).toBe(1);
  });

  it("aggregates all students in a course in batch mode", async () => {
    attendanceRecords = [
      { studentId: "student-1", courseId: "course-1", status: "PRESENT" },
      { studentId: "student-1", courseId: "course-1", status: "ABSENT" },
      { studentId: "student-2", courseId: "course-1", status: "PRESENT" },
      { studentId: "student-3", courseId: "course-2", status: "ABSENT" },
    ];

    const { AttendanceAggregationService } = await import(
      "@webcampus/api/src/services/faculty/attendance-aggregation.service"
    );

    const result =
      await AttendanceAggregationService.aggregateAttendanceForCourse(
        "course-1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dbMock as any
      );

    expect(result.status).toBe("success");
    if (result.status === "error" || !result.data) {
      throw new Error("Expected successful batch aggregation");
    }

    expect(result.data.processedCount).toBe(2);
    expect(attendanceStore.has("student-1:course-1")).toBe(true);
    expect(attendanceStore.has("student-2:course-1")).toBe(true);
    expect(attendanceStore.has("student-3:course-2")).toBe(false);
  });

  it("deletes attendance summary row when no attendance records remain", async () => {
    attendanceStore.set("student-1:course-1", {
      id: "student-1:course-1",
      studentId: "student-1",
      courseId: "course-1",
      total: 1,
      present: 1,
      absent: 0,
      percentage: 100,
      condonationStatus: "APPROVED",
      batchId: null,
      electiveBatchId: null,
    });

    attendanceRecords = [];

    const { AttendanceAggregationService } = await import(
      "@webcampus/api/src/services/faculty/attendance-aggregation.service"
    );

    const result =
      await AttendanceAggregationService.aggregateAttendanceForStudentCourse(
        "student-1",
        "course-1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dbMock as any
      );

    expect(result.status).toBe("success");
    if (result.status === "error" || !result.data) {
      throw new Error("Expected successful aggregation result");
    }

    expect(result.data.total).toBe(0);
    expect(result.data.present).toBe(0);
    expect(result.data.absent).toBe(0);
    expect(attendanceStore.has("student-1:course-1")).toBe(false);
  });
});
