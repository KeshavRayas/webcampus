/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

type SessionRecord = {
  id: string;
  courseId: string;
  sectionId: string;
  facultyId: string;
  sessionDate: Date;
  timingCode: string;
  timingLabel: string;
  timingStartTime: string;
  timingEndTime: string;
  createdAt: Date;
  Course?: {
    code: string;
    name: string;
  };
  Section?: {
    name: string;
  };
};

const facultyByUserId: Record<string, string> = {
  "user-1": "faculty-1",
  "user-2": "faculty-2",
};

let assignments: Array<{
  facultyId: string;
  courseId: string;
  sectionId: string;
}> = [];
let sessions: SessionRecord[] = [];
let attendanceRecordRows: Array<{ sessionId: string; studentId: string }> = [];
let simulateListIncludeFailure = false;
let aggregateAttendanceForCourseCalls = 0;
let aggregateAttendanceForStudentCourseCalls: Array<{
  studentId: string;
  courseId: string;
}> = [];

const toMinutes = (time: string): number => {
  const [hourText, minuteText] = time.split(":");
  return Number(hourText) * 60 + Number(minuteText);
};

const hasOverlap = (
  startTime: string,
  endTime: string,
  existingStartTime: string,
  existingEndTime: string
): boolean => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const existingStart = toMinutes(existingStartTime);
  const existingEnd = toMinutes(existingEndTime);

  return start < existingEnd && end > existingStart;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const matchesOverlapScope = (where: any, session: SessionRecord): boolean => {
  const facultyMatches = where.OR?.some(
    (
      clause: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
    ) => clause.facultyId === session.facultyId
  );
  const sectionMatches = where.OR?.some(
    (
      clause: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
    ) => clause.sectionId === session.sectionId
  );

  if (where.OR?.length) {
    return Boolean(facultyMatches || sectionMatches);
  }

  return (
    where.facultyId === session.facultyId ||
    where.sectionId === session.sectionId
  );
};

const dbMock = {
  faculty: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: async ({ where }: any) => {
      const facultyId = facultyByUserId[where.userId];
      return facultyId ? { id: facultyId } : null;
    },
  },
  courseAssignment: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: async ({ where }: any) => {
      const match = assignments.find(
        (assignment) =>
          assignment.facultyId === where.facultyId &&
          assignment.courseId === where.courseId &&
          assignment.sectionId === where.sectionId
      );

      return match
        ? {
            id: "assignment-1",
            semester: 3,
            academicYear: "2025-26",
            assignmentType: "THEORY",
            batchId: null,
            course: {
              semesterId: "semester-uuid",
              semester: {
                academicTermId: "term-uuid",
              },
            },
          }
        : null;
    },
  },
  classSession: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: async ({ where, include }: any) => {
      if (where.id) {
        const matchedSession =
          sessions.find((session) => session.id === where.id) ?? null;
        if (!matchedSession) {
          return null;
        }

        if (include?.AttendanceRecord) {
          return {
            ...matchedSession,
            AttendanceRecord: attendanceRecordRows
              .filter((record) => record.sessionId === matchedSession.id)
              .map((record) => ({ studentId: record.studentId })),
          };
        }

        return matchedSession;
      }

      const key = where.courseId_sectionId_sessionDate_timingCode;
      return (
        sessions.find(
          (session) =>
            session.courseId === key.courseId &&
            session.sectionId === key.sectionId &&
            session.sessionDate.getTime() === key.sessionDate.getTime() &&
            session.timingCode === key.timingCode
        ) ?? null
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count: async ({ where }: any) => {
      return sessions.filter((session) => {
        if (where.facultyId && session.facultyId !== where.facultyId) {
          return false;
        }

        if (where.courseId && session.courseId !== where.courseId) {
          return false;
        }

        if (where.sectionId && session.sectionId !== where.sectionId) {
          return false;
        }

        if (where.sessionDate) {
          const sessionTime = session.sessionDate.getTime();
          if (
            where.sessionDate.gte &&
            sessionTime < where.sessionDate.gte.getTime()
          ) {
            return false;
          }

          if (
            where.sessionDate.lt &&
            sessionTime >= where.sessionDate.lt.getTime()
          ) {
            return false;
          }
        }

        return true;
      }).length;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: async ({ where }: any) => {
      if (where.timingCode) {
        return (
          sessions.find((session) => {
            if (session.sessionDate.getTime() !== where.sessionDate.getTime()) {
              return false;
            }

            if (session.courseId !== where.courseId) {
              return false;
            }

            if (session.sectionId !== where.sectionId) {
              return false;
            }

            if (session.timingCode !== where.timingCode) {
              return false;
            }

            return true;
          }) ?? null
        );
      }

      const requestedEnd = where.timingStartTime?.lt;
      const requestedStart = where.timingEndTime?.gt;

      return (
        sessions.find((session) => {
          if (session.sessionDate.getTime() !== where.sessionDate.getTime()) {
            return false;
          }

          if (!matchesOverlapScope(where, session)) {
            return false;
          }

          if (!requestedEnd || !requestedStart) {
            return true;
          }

          return hasOverlap(
            requestedStart,
            requestedEnd,
            session.timingStartTime,
            session.timingEndTime
          );
        }) ?? null
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: async ({ where, skip, take }: any) => {
      if (simulateListIncludeFailure) {
        simulateListIncludeFailure = false;
        throw new Error(
          "Inconsistent query result: Field Course is required to return data, got null instead"
        );
      }

      return sessions
        .filter((session) => {
          if (where.facultyId && session.facultyId !== where.facultyId) {
            return false;
          }

          if (where.courseId && session.courseId !== where.courseId) {
            return false;
          }

          if (where.sectionId && session.sectionId !== where.sectionId) {
            return false;
          }

          if (where.sessionDate) {
            const sessionTime = session.sessionDate.getTime();
            if (
              where.sessionDate.gte &&
              sessionTime < where.sessionDate.gte.getTime()
            ) {
              return false;
            }

            if (
              where.sessionDate.lt &&
              sessionTime >= where.sessionDate.lt.getTime()
            ) {
              return false;
            }
          }

          return true;
        })
        .sort((left, right) => {
          if (left.sessionDate.getTime() !== right.sessionDate.getTime()) {
            return right.sessionDate.getTime() - left.sessionDate.getTime();
          }

          return right.createdAt.getTime() - left.createdAt.getTime();
        })
        .slice(skip ?? 0, (skip ?? 0) + (take ?? sessions.length));
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: async ({ data }: any) => {
      const created: SessionRecord = {
        id: data.id,
        courseId: data.courseId,
        sectionId: data.sectionId,
        facultyId: data.facultyId,
        sessionDate: data.sessionDate,
        timingCode: data.timingCode,
        timingLabel: data.timingLabel,
        timingStartTime: data.timingStartTime,
        timingEndTime: data.timingEndTime,
        createdAt: new Date("2026-04-13T05:00:00.000Z"),
        Course: {
          code: "CS301",
          name: "Algorithms",
        },
        Section: {
          name: "A",
        },
      };

      sessions.push(created);
      return created;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete: async ({ where }: any) => {
      const existing = sessions.find((session) => session.id === where.id);
      if (!existing) {
        throw new Error("Attendance session not found");
      }

      sessions = sessions.filter((session) => session.id !== where.id);
      attendanceRecordRows = attendanceRecordRows.filter(
        (record) => record.sessionId !== where.id
      );

      return existing;
    },
  },
  course: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: async ({ where }: any) => {
      const session = sessions.find((s) => s.courseId === where?.id);
      return {
        id: where?.id ?? "course-1",
        code: session?.Course?.code ?? "CS301",
        courseType: "PC",
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: async ({ where }: any) => {
      const ids: string[] = where?.id?.in ?? [];
      const byId = new Map<
        string,
        { id: string; code: string; name: string }
      >();

      for (const session of sessions) {
        if (!session.Course) {
          continue;
        }

        if (!ids.includes(session.courseId)) {
          continue;
        }

        byId.set(session.courseId, {
          id: session.courseId,
          code: session.Course.code,
          name: session.Course.name,
        });
      }

      return Array.from(byId.values());
    },
  },
  section: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: async ({ where }: any) => {
      const ids: string[] = where?.id?.in ?? [];
      const byId = new Map<string, { id: string; name: string }>();

      for (const session of sessions) {
        if (!session.Section) {
          continue;
        }

        if (!ids.includes(session.sectionId)) {
          continue;
        }

        byId.set(session.sectionId, {
          id: session.sectionId,
          name: session.Section.name,
        });
      }

      return Array.from(byId.values());
    },
  },
  courseRegistration: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: async (): Promise<any[]> => {
      // Mock registered students for the course
      return [{ studentId: "student-1" }, { studentId: "student-2" }];
    },
  },
  electiveBatchFaculty: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: async (): Promise<any[]> => [],
  },
  attendanceRecord: {
    createMany: async () => ({}),
    upsert: async () => ({}),
  },
  attendance: {
    upsert: async () => ({}),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: async (callback: (tx: any) => Promise<any>) => {
    // Simple transaction mock - pass the db object as the transaction client
    return await callback(dbMock);
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
  },
}));

mock.module(
  "@webcampus/api/src/services/faculty/attendance-aggregation.service",
  () => ({
    AttendanceAggregationService: {
      aggregateAttendanceForCourse: async () => {
        aggregateAttendanceForCourseCalls += 1;
        return { success: true };
      },
      aggregateAttendanceForStudentCourse: async (
        studentId: string,
        courseId: string
      ) => {
        aggregateAttendanceForStudentCourseCalls.push({ studentId, courseId });
        return { success: true };
      },
    },
  })
);

describe("FacultyAttendanceSessionService", () => {
  beforeEach(() => {
    assignments = [
      { facultyId: "faculty-1", courseId: "course-1", sectionId: "section-1" },
    ];
    sessions = [];
    attendanceRecordRows = [];
    simulateListIncludeFailure = false;
    aggregateAttendanceForCourseCalls = 0;
    aggregateAttendanceForStudentCourseCalls = [];
  });

  it("includes lab batch metadata in attendance filter options", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dbMock.courseAssignment as any).findMany = async () => [
      {
        assignmentType: "THEORY",
        batchId: null,
        batch: null,
        course: { id: "course-1", code: "CS301", name: "Algorithms" },
        section: { id: "section-1", name: "A" },
      },
      {
        assignmentType: "LAB",
        batchId: "batch-1",
        batch: { name: "Lab Batch 1" },
        course: { id: "course-1", code: "CS301", name: "Algorithms" },
        section: { id: "section-1", name: "A" },
      },
    ];

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response =
      await FacultyAttendanceSessionService.getFilterOptions("user-1");

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.courses).toHaveLength(1);
    expect(response.data.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "section-1",
          courseId: "course-1",
          assignmentType: "LAB",
          batchId: "batch-1",
          labBatchNumber: 1,
        }),
      ])
    );
  });

  it("lists existing sessions for the authenticated faculty", async () => {
    sessions.push({
      id: "session-list-1",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    sessions.push({
      id: "session-list-2",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-12T00:00:00.000Z"),
      timingCode: "09:50-10:45",
      timingLabel: "09:50 AM - 10:45 AM",
      timingStartTime: "09:50",
      timingEndTime: "10:45",
      createdAt: new Date("2026-04-12T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.listSessions(
      "user-1",
      {
        page: 1,
        limit: 10,
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.items).toHaveLength(2);
    const firstListedSession = response.data.items[0];
    const secondListedSession = response.data.items[1];
    if (!firstListedSession || !secondListedSession) {
      throw new Error("Expected both listed sessions to be present");
    }

    expect(firstListedSession.id).toBe("session-list-1");
    expect(secondListedSession.id).toBe("session-list-2");
    expect(response.data.pagination.total).toBe(2);

    expect(firstListedSession.courseCode).toBe("CS301");
    expect(firstListedSession.courseName).toBe("Algorithms");
    expect(firstListedSession.sectionName).toBe("A");
  });

  it("filters listed sessions by session date", async () => {
    sessions.push({
      id: "session-filter-1",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    sessions.push({
      id: "session-filter-2",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-12T00:00:00.000Z"),
      timingCode: "09:50-10:45",
      timingLabel: "09:50 AM - 10:45 AM",
      timingStartTime: "09:50",
      timingEndTime: "10:45",
      createdAt: new Date("2026-04-12T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.listSessions(
      "user-1",
      {
        page: 1,
        limit: 10,
        sessionDate: "2026-04-13",
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.items).toHaveLength(1);
    const filteredSession = response.data.items[0];
    if (!filteredSession) {
      throw new Error("Expected filtered session to be present");
    }

    expect(filteredSession.id).toBe("session-filter-1");
  });

  it("lists sessions when page and limit arrive as strings", async () => {
    sessions.push({
      id: "session-pagination-string-1",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.listSessions(
      "user-1",
      {
        page: "1" as unknown as number,
        limit: "10" as unknown as number,
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.items).toHaveLength(1);
    expect(response.data.pagination.page).toBe(1);
    expect(response.data.pagination.limit).toBe(10);
  });

  it("lists sessions even when relation include resolution fails", async () => {
    sessions.push({
      id: "session-list-fallback-1",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    simulateListIncludeFailure = true;

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.listSessions(
      "user-1",
      {
        page: 1,
        limit: 10,
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.items).toHaveLength(1);
    const fallbackListedSession = response.data.items[0];
    if (!fallbackListedSession) {
      throw new Error("Expected fallback listed session to be present");
    }

    expect(fallbackListedSession.courseCode).toBe("CS301");
    expect(fallbackListedSession.sectionName).toBe("A");
  });

  it("throws conflict when creating attendance for an existing session", async () => {
    sessions.push({
      id: "session-existing",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    attendanceRecordRows.push(
      { sessionId: "session-existing", studentId: "student-1" },
      { sessionId: "session-existing", studentId: "student-2" }
    );

    const sessionCountBefore = sessions.length;
    const recordsSnapshot = [...attendanceRecordRows];

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    await expect(
      FacultyAttendanceSessionService.createSession("user-1", {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "FIXED",
        timingCode: "08:00-08:55",
      })
    ).rejects.toThrow(
      "Attendance already taken for this session. Please use Edit Attendance to modify it."
    );

    expect(sessions).toHaveLength(sessionCountBefore);
    expect(attendanceRecordRows).toEqual(recordsSnapshot);
  });

  it("returns ownership mismatch when same slot belongs to another faculty", async () => {
    sessions.push({
      id: "session-other-faculty",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-2",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    await expect(
      FacultyAttendanceSessionService.createSession("user-1", {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "FIXED",
        timingCode: "08:00-08:55",
      })
    ).rejects.toThrow(
      "Attendance already taken for this session. Please use Edit Attendance to modify it."
    );
  });

  it("throws when custom timing overlaps an existing session", async () => {
    sessions.push({
      id: "session-existing",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "09:00-10:00",
      timingLabel: "09:00 - 10:00",
      timingStartTime: "09:00",
      timingEndTime: "10:00",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    await expect(
      FacultyAttendanceSessionService.createSession("user-1", {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "CUSTOM",
        timingStartTime: "09:30",
        timingEndTime: "10:15",
      })
    ).rejects.toThrow(
      "Faculty Overlap: You are already conducting a session at 09:00 - 10:00. You cannot take multiple classes at once."
    );
  });

  it("creates a new session when timing is adjacent but non-overlapping", async () => {
    sessions.push({
      id: "session-existing",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "09:00-10:00",
      timingLabel: "09:00 - 10:00",
      timingStartTime: "09:00",
      timingEndTime: "10:00",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.createSession(
      "user-1",
      {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "CUSTOM",
        timingStartTime: "10:00",
        timingEndTime: "11:00",
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.created).toBe(true);
    expect(response.data.session.timingCode).toBe("10:00-11:00");
  });

  it("throws when overlapping a session owned by the same faculty in another section", async () => {
    assignments = [
      { facultyId: "faculty-1", courseId: "course-1", sectionId: "section-1" },
      { facultyId: "faculty-1", courseId: "course-2", sectionId: "section-2" },
    ];

    sessions.push({
      id: "session-same-faculty",
      courseId: "course-2",
      sectionId: "section-2",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "09:00-10:00",
      timingLabel: "09:00 - 10:00",
      timingStartTime: "09:00",
      timingEndTime: "10:00",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS302", name: "Data Structures" },
      Section: { name: "B" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    await expect(
      FacultyAttendanceSessionService.createSession("user-1", {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "CUSTOM",
        timingStartTime: "09:30",
        timingEndTime: "10:15",
      })
    ).rejects.toThrow(
      "Faculty Overlap: You are already conducting a session at 09:00 - 10:00. You cannot take multiple classes at once."
    );
  });

  it("throws when overlapping a session in the same section owned by another faculty", async () => {
    sessions.push({
      id: "session-same-section",
      courseId: "course-2",
      sectionId: "section-1",
      facultyId: "faculty-2",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "09:00-10:00",
      timingLabel: "09:00 - 10:00",
      timingStartTime: "09:00",
      timingEndTime: "10:00",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS302", name: "Data Structures" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    await expect(
      FacultyAttendanceSessionService.createSession("user-1", {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "CUSTOM",
        timingStartTime: "09:30",
        timingEndTime: "10:15",
      })
    ).rejects.toThrow(
      "Section Overlap: Another faculty member is already conducting a session for this section at 09:00 - 10:00."
    );
  });

  it("creates a new session when overlap boundaries only touch", async () => {
    sessions.push({
      id: "session-boundary",
      courseId: "course-2",
      sectionId: "section-1",
      facultyId: "faculty-2",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "09:00-10:00",
      timingLabel: "09:00 - 10:00",
      timingStartTime: "09:00",
      timingEndTime: "10:00",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS302", name: "Data Structures" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.createSession(
      "user-1",
      {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "CUSTOM",
        timingStartTime: "10:00",
        timingEndTime: "11:00",
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.created).toBe(true);
    expect(response.data.session.timingCode).toBe("10:00-11:00");
  });

  it("creates new session when no existing or overlap is found", async () => {
    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.createSession(
      "user-1",
      {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "FIXED",
        timingCode: "11:15-12:10",
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.created).toBe(true);
    expect(response.data.session.timingCode).toBe("11:15-12:10");
    expect(sessions).toHaveLength(1);
  });

  it("should trigger aggregation when session is created", async () => {
    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.createSession(
      "user-1",
      {
        courseId: "course-1",
        sectionId: "section-1",
        sessionDate: new Date("2026-04-13"),
        timingMode: "FIXED",
        timingCode: "08:00-08:55",
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.created).toBe(true);
    expect(response.data.session.courseId).toBe("course-1");
    expect(aggregateAttendanceForCourseCalls).toBe(1);
  });

  it("deletes owned session and re-aggregates affected students", async () => {
    sessions.push({
      id: "session-delete-1",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-1",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });
    attendanceRecordRows = [
      { sessionId: "session-delete-1", studentId: "student-1" },
      { sessionId: "session-delete-1", studentId: "student-2" },
      { sessionId: "session-delete-1", studentId: "student-1" },
    ];

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    const response = await FacultyAttendanceSessionService.deleteSession(
      "user-1",
      {
        sessionId: "session-delete-1",
      }
    );

    expect(response.status).toBe("success");
    if (response.status === "error" || !response.data) {
      throw new Error("Expected success response with data");
    }

    expect(response.data.sessionId).toBe("session-delete-1");
    expect(response.data.courseId).toBe("course-1");
    expect(response.data.affectedStudentCount).toBe(2);
    expect(sessions.some((session) => session.id === "session-delete-1")).toBe(
      false
    );
    expect(aggregateAttendanceForStudentCourseCalls).toEqual([
      { studentId: "student-1", courseId: "course-1" },
      { studentId: "student-2", courseId: "course-1" },
    ]);
  });

  it("rejects delete when session belongs to another faculty", async () => {
    sessions.push({
      id: "session-delete-forbidden",
      courseId: "course-1",
      sectionId: "section-1",
      facultyId: "faculty-2",
      sessionDate: new Date("2026-04-13T00:00:00.000Z"),
      timingCode: "08:00-08:55",
      timingLabel: "08:00 AM - 08:55 AM",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
      createdAt: new Date("2026-04-13T04:00:00.000Z"),
      Course: { code: "CS301", name: "Algorithms" },
      Section: { name: "A" },
    });

    const { FacultyAttendanceSessionService } = await import(
      "../attendance-session.service"
    );

    await expect(
      FacultyAttendanceSessionService.deleteSession("user-1", {
        sessionId: "session-delete-forbidden",
      })
    ).rejects.toThrow("Forbidden");
  });

  describe("updateSession", () => {
    beforeEach(() => {
      assignments = [
        {
          facultyId: "faculty-1",
          courseId: "course-1",
          sectionId: "section-1",
        },
      ];
      sessions = [];
      attendanceRecordRows = [];
      aggregateAttendanceForCourseCalls = 0;
      aggregateAttendanceForStudentCourseCalls = [];
    });

    it("updates attendance records for an existing session", async () => {
      const existing: SessionRecord = {
        id: "session-update-1",
        courseId: "course-1",
        sectionId: "section-1",
        facultyId: "faculty-1",
        sessionDate: new Date("2026-04-13T00:00:00.000Z"),
        timingCode: "08:00-08:55",
        timingLabel: "08:00 AM - 08:55 AM",
        timingStartTime: "08:00",
        timingEndTime: "08:55",
        createdAt: new Date("2026-04-13T04:00:00.000Z"),
        Course: { code: "CS301", name: "Algorithms" },
        Section: { name: "A" },
      };
      sessions.push(existing);

      const { FacultyAttendanceSessionService } = await import(
        "../attendance-session.service"
      );

      const response = await FacultyAttendanceSessionService.updateSession(
        "user-1",
        "session-update-1",
        [
          { studentId: "student-1", status: "PRESENT" },
          { studentId: "student-2", status: "ABSENT" },
        ]
      );

      expect(response.status).toBe("success");
      if (response.status === "error" || !response.data) {
        throw new Error("Expected success response with data");
      }

      expect(response.data.created).toBe(false);
      expect(response.data.session.id).toBe("session-update-1");
      expect(response.data.attendanceInitialization.totalStudents).toBe(2);
      expect(response.data.attendanceInitialization.absentCount).toBe(1);
      expect(response.data.attendanceInitialization.presentCount).toBe(1);
    });

    it("preserves session ID and does not create a second session", async () => {
      const existing: SessionRecord = {
        id: "session-update-2",
        courseId: "course-1",
        sectionId: "section-1",
        facultyId: "faculty-1",
        sessionDate: new Date("2026-04-13T00:00:00.000Z"),
        timingCode: "08:00-08:55",
        timingLabel: "08:00 AM - 08:55 AM",
        timingStartTime: "08:00",
        timingEndTime: "08:55",
        createdAt: new Date("2026-04-13T04:00:00.000Z"),
        Course: { code: "CS301", name: "Algorithms" },
        Section: { name: "A" },
      };
      sessions.push(existing);

      const sessionCountBefore = sessions.length;

      const { FacultyAttendanceSessionService } = await import(
        "../attendance-session.service"
      );

      const response = await FacultyAttendanceSessionService.updateSession(
        "user-1",
        "session-update-2",
        [
          { studentId: "student-1", status: "ABSENT" },
          { studentId: "student-2", status: "PRESENT" },
        ]
      );

      expect(response.status).toBe("success");
      if (response.status === "error" || !response.data) {
        throw new Error("Expected success response with data");
      }

      expect(response.data.session.id).toBe("session-update-2");
      expect(sessions).toHaveLength(sessionCountBefore);
    });

    it("returns 404 for unknown session", async () => {
      const { FacultyAttendanceSessionService } = await import(
        "../attendance-session.service"
      );

      await expect(
        FacultyAttendanceSessionService.updateSession(
          "user-1",
          "session-nonexistent",
          []
        )
      ).rejects.toThrow("Attendance session not found");
    });

    it("returns 403 for another faculty's session", async () => {
      const existing: SessionRecord = {
        id: "session-other-faculty-update",
        courseId: "course-2",
        sectionId: "section-2",
        facultyId: "faculty-2",
        sessionDate: new Date("2026-04-13T00:00:00.000Z"),
        timingCode: "08:00-08:55",
        timingLabel: "08:00 AM - 08:55 AM",
        timingStartTime: "08:00",
        timingEndTime: "08:55",
        createdAt: new Date("2026-04-13T04:00:00.000Z"),
      };
      sessions.push(existing);

      const { FacultyAttendanceSessionService } = await import(
        "../attendance-session.service"
      );

      await expect(
        FacultyAttendanceSessionService.updateSession(
          "user-1",
          "session-other-faculty-update",
          [{ studentId: "student-1", status: "PRESENT" }]
        )
      ).rejects.toThrow("Forbidden: session not owned by faculty");
    });

    it("does not modify attendance when faculty ownership validation fails", async () => {
      const existing: SessionRecord = {
        id: "session-ownership-fail",
        courseId: "course-2",
        sectionId: "section-2",
        facultyId: "faculty-2",
        sessionDate: new Date("2026-04-13T00:00:00.000Z"),
        timingCode: "08:00-08:55",
        timingLabel: "08:00 AM - 08:55 AM",
        timingStartTime: "08:00",
        timingEndTime: "08:55",
        createdAt: new Date("2026-04-13T04:00:00.000Z"),
      };
      sessions.push(existing);
      attendanceRecordRows.push({
        sessionId: "session-ownership-fail",
        studentId: "student-1",
      });

      const recordsSnapshot = [...attendanceRecordRows];

      const { FacultyAttendanceSessionService } = await import(
        "../attendance-session.service"
      );

      await expect(
        FacultyAttendanceSessionService.updateSession(
          "user-1",
          "session-ownership-fail",
          [{ studentId: "student-1", status: "ABSENT" }]
        )
      ).rejects.toThrow("Forbidden");

      expect(attendanceRecordRows).toEqual(recordsSnapshot);
    });

    it("triggers attendance aggregation after update", async () => {
      const existing: SessionRecord = {
        id: "session-aggregation",
        courseId: "course-1",
        sectionId: "section-1",
        facultyId: "faculty-1",
        sessionDate: new Date("2026-04-13T00:00:00.000Z"),
        timingCode: "08:00-08:55",
        timingLabel: "08:00 AM - 08:55 AM",
        timingStartTime: "08:00",
        timingEndTime: "08:55",
        createdAt: new Date("2026-04-13T04:00:00.000Z"),
        Course: { code: "CS301", name: "Algorithms" },
        Section: { name: "A" },
      };
      sessions.push(existing);

      const { FacultyAttendanceSessionService } = await import(
        "../attendance-session.service"
      );

      const response = await FacultyAttendanceSessionService.updateSession(
        "user-1",
        "session-aggregation",
        [
          { studentId: "student-1", status: "PRESENT" },
          { studentId: "student-2", status: "ABSENT" },
        ]
      );

      expect(response.status).toBe("success");
      expect(aggregateAttendanceForCourseCalls).toBe(1);
    });
  });
});
