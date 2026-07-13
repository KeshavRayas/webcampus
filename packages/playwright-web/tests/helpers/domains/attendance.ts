import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  session: "/faculty/attendance-session",
  saveAttendance: "/faculty/attendance/save",
  report: "/faculty/attendance/report",
};

type SessionResponse = {
  status: string;
  data?: {
    id: string;
    courseId: string;
    sectionId: string;
    sessionDate: string;
  };
};

type AttendanceSaveResponse = {
  status: string;
  data?: {
    updated: number;
  };
};

type ReportResponse = {
  status: string;
  data?: {
    records: Array<{
      id: string;
      studentId: string;
      status: string;
    }>;
  };
};

export async function createSession(
  api: ApiHelper,
  data: {
    courseId: string;
    sectionId: string;
    facultyId: string;
    sessionDate: string;
    timingCode: string;
    timingStartTime: string;
    timingEndTime: string;
    batchId?: string;
  }
): Promise<{ id: string }> {
  const res = await api.post<SessionResponse>(
    PATHS.session,
    data as unknown as Record<string, unknown>
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(
      `Failed to create attendance session: ${JSON.stringify(res)}`
    );
  }
  return { id: res.data.id };
}

export async function markAttendance(
  api: ApiHelper,
  sessionId: string,
  records: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT";
    batchId?: string;
  }>
): Promise<void> {
  const res = await api.post<AttendanceSaveResponse>(PATHS.saveAttendance, {
    sessionId,
    records,
  });
  if (res.status !== "success") {
    throw new Error(`Failed to mark attendance: ${JSON.stringify(res)}`);
  }
}

export async function getAttendanceReport(
  api: ApiHelper,
  sessionId: string
): Promise<ReportResponse["data"]> {
  const res = await api.get<ReportResponse>(
    `${PATHS.report}?sessionId=${sessionId}`
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to get attendance report: ${JSON.stringify(res)}`);
  }
  return res.data;
}

export async function verifyAttendanceInDb(sessionId: string) {
  return testDb.attendanceRecord.findMany({
    where: { sessionId },
    select: { id: true, studentId: true, status: true },
  });
}

export async function verifyAggregationInDb(
  studentId: string,
  courseId: string
) {
  return testDb.attendance.findFirst({
    where: { studentId, courseId },
  });
}
