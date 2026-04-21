import { type Page, type Route } from "@playwright/test";
import type {
  CreateOrOpenFacultyAttendanceSessionPayloadDTO,
  FacultyAttendanceFilterOptionsDTO,
  FacultyAttendanceSessionDetailDTO,
  FacultyAttendanceSessionDTO,
  FacultyAttendanceSessionStudentDTO,
  PaginatedResponse,
} from "@webcampus/types/api";

const ATTENDANCE_DATE = "2026-04-16";
const DEFAULT_COURSE_ID = "course-1";
const DEFAULT_SECTION_ID = "section-1";
const DEFAULT_SESSION_ID = "session-existing";
const SAVED_SESSION_ID = "session-saved";

export const facultyAttendanceFilterOptionsMock: FacultyAttendanceFilterOptionsDTO = {
  courses: [
    {
      id: DEFAULT_COURSE_ID,
      code: "CS301",
      name: "Algorithms",
    },
  ],
  sections: [
    {
      id: DEFAULT_SECTION_ID,
      name: "A",
      courseId: DEFAULT_COURSE_ID,
    },
  ],
};

export const facultyAttendanceRosterStudentsMock: FacultyAttendanceSessionStudentDTO[] = [
  {
    studentId: "student-1",
    usn: "1BM22CS001",
    name: "Alice Johnson",
    status: "PRESENT",
  },
  {
    studentId: "student-2",
    usn: "1BM22CS002",
    name: "Bob Rao",
    status: "PRESENT",
  },
];

export const facultyAttendanceExistingSessionMock: FacultyAttendanceSessionDTO = {
  id: DEFAULT_SESSION_ID,
  courseId: DEFAULT_COURSE_ID,
  sectionId: DEFAULT_SECTION_ID,
  sessionDate: ATTENDANCE_DATE,
  timingCode: "08:00-08:55",
  timingLabel: "08:00 AM - 08:55 AM",
  timingStartTime: "08:00",
  timingEndTime: "08:55",
  courseCode: "CS301",
  courseName: "Algorithms",
  sectionName: "A",
  createdAt: "2026-04-16T08:00:00.000Z",
};

export const facultyAttendanceExistingSessionStudentsMock: FacultyAttendanceSessionStudentDTO[] = [
  {
    studentId: "student-1",
    usn: "1BM22CS001",
    name: "Alice Johnson",
    status: "PRESENT",
  },
  {
    studentId: "student-2",
    usn: "1BM22CS002",
    name: "Bob Rao",
    status: "ABSENT",
  },
];

export type FacultyAttendanceMockState = {
  rosterStudents: FacultyAttendanceSessionStudentDTO[];
  existingSession: FacultyAttendanceSessionDTO | null;
  existingSessionStudents: FacultyAttendanceSessionStudentDTO[];
  savedSession: FacultyAttendanceSessionDTO | null;
  savedSessionStudents: FacultyAttendanceSessionStudentDTO[];
  saveRequests: CreateOrOpenFacultyAttendanceSessionPayloadDTO[];
};

export const createFacultyAttendanceMockState = (
  overrides: Partial<FacultyAttendanceMockState> = {}
): FacultyAttendanceMockState => ({
  rosterStudents: facultyAttendanceRosterStudentsMock,
  existingSession: null,
  existingSessionStudents: facultyAttendanceExistingSessionStudentsMock,
  savedSession: null,
  savedSessionStudents: [],
  saveRequests: [],
  ...overrides,
});

const buildSessionList = (state: FacultyAttendanceMockState) => {
  const sessions = [state.existingSession, state.savedSession].filter(
    Boolean
  ) as FacultyAttendanceSessionDTO[];

  return sessions;
};

const filterSessions = (
  sessions: FacultyAttendanceSessionDTO[],
  searchParams: URLSearchParams
) => {
  const normalizeFilterValue = (value: string | null) => {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === "all" ? null : value.trim();
  };

  return sessions.filter((session) => {
    const courseId = normalizeFilterValue(searchParams.get("courseId"));
    const sectionId = normalizeFilterValue(searchParams.get("sectionId"));
    const sessionDate = normalizeFilterValue(searchParams.get("sessionDate"));

    if (courseId && session.courseId !== courseId) {
      return false;
    }

    if (sectionId && session.sectionId !== sectionId) {
      return false;
    }

    if (sessionDate && session.sessionDate.slice(0, 10) !== sessionDate) {
      return false;
    }

    return true;
  });
};

const toListResponse = (
  sessions: FacultyAttendanceSessionDTO[],
  page: number,
  limit: number
): PaginatedResponse<FacultyAttendanceSessionDTO> => {
  const start = (page - 1) * limit;
  const items = sessions.slice(start, start + limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total: sessions.length,
      totalPages: Math.max(1, Math.ceil(sessions.length / limit)),
      hasNextPage: start + limit < sessions.length,
      hasPreviousPage: page > 1,
    },
  };
};

const toSessionDetailResponse = (
  session: FacultyAttendanceSessionDTO,
  students: FacultyAttendanceSessionStudentDTO[]
): FacultyAttendanceSessionDetailDTO => {
  return {
    session,
    students,
  };
};

const toCreatedSession = (
  payload: CreateOrOpenFacultyAttendanceSessionPayloadDTO,
  createdAt: string,
  sessionId: string
): FacultyAttendanceSessionDTO => {
  const fixedTimingCode = payload.timingCode || "";
  const [fixedStartTime = "08:00", fixedEndTime = "08:55"] =
    fixedTimingCode.split("-");
  const timingLabel =
    payload.timingMode === "FIXED"
      ? payload.timingCode === "08:00-08:55"
        ? "08:00 AM - 08:55 AM"
        : payload.timingCode || ""
      : `${payload.timingStartTime} - ${payload.timingEndTime}`;

  return {
    id: sessionId,
    courseId: payload.courseId,
    sectionId: payload.sectionId,
    sessionDate: payload.sessionDate,
    timingCode:
      payload.timingMode === "FIXED"
        ? payload.timingCode || ""
        : `${payload.timingStartTime}-${payload.timingEndTime}`,
    timingLabel,
    timingStartTime:
      payload.timingMode === "FIXED"
        ? payload.timingStartTime || fixedStartTime
        : payload.timingStartTime || "08:00",
    timingEndTime:
      payload.timingMode === "FIXED"
        ? payload.timingEndTime || fixedEndTime
        : payload.timingEndTime || "08:55",
    courseCode: "CS301",
    courseName: "Algorithms",
    sectionName: "A",
    createdAt,
  };
};

const getPayloadTimingCode = (
  payload: CreateOrOpenFacultyAttendanceSessionPayloadDTO
) => {
  if (payload.timingMode === "FIXED") {
    return payload.timingCode || "";
  }

  return `${payload.timingStartTime}-${payload.timingEndTime}`;
};

const findMatchingSession = (
  state: FacultyAttendanceMockState,
  payload: CreateOrOpenFacultyAttendanceSessionPayloadDTO
) => {
  const payloadTimingCode = getPayloadTimingCode(payload);
  const payloadSessionDate = payload.sessionDate.slice(0, 10);

  const candidates = [state.savedSession, state.existingSession].filter(
    Boolean
  ) as FacultyAttendanceSessionDTO[];

  return (
    candidates.find((session) => {
      return (
        session.courseId === payload.courseId &&
        session.sectionId === payload.sectionId &&
        session.sessionDate.slice(0, 10) === payloadSessionDate &&
        session.timingCode === payloadTimingCode
      );
    }) ?? null
  );
};

const applyPayloadStatuses = (
  rosterStudents: FacultyAttendanceSessionStudentDTO[],
  payload: CreateOrOpenFacultyAttendanceSessionPayloadDTO
) => {
  const statusByStudent = new Map(
    (payload.studentStatuses ?? []).map((item) => [item.studentId, item.status])
  );

  return rosterStudents.map((student) => ({
    ...student,
    status: statusByStudent.get(student.studentId) ?? "PRESENT",
  }));
};

export const mockFacultyAttendanceApis = async (
  page: Page,
  state: FacultyAttendanceMockState
) => {
  await page.route("**/faculty/attendance/session**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;

    if (pathname.endsWith("/filter-options")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: "Attendance filter options retrieved successfully",
          data: facultyAttendanceFilterOptionsMock,
        }),
      });
      return;
    }

    if (pathname.endsWith("/students")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: "Session students retrieved successfully",
          data: {
            students: state.rosterStudents,
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/detail")) {
      const sessionId = searchParams.get("sessionId");

      const matchedSession =
        state.savedSession?.id === sessionId
          ? state.savedSession
          : state.existingSession?.id === sessionId
            ? state.existingSession
            : null;

      const matchedStudents =
        state.savedSession?.id === sessionId
          ? state.savedSessionStudents
          : state.existingSession?.id === sessionId
            ? state.existingSessionStudents
            : null;

      if (!matchedSession || !matchedStudents) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            status: "error",
            message: "Attendance session not found",
            error: "Attendance session not found",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: "Attendance session detail retrieved successfully",
          data: toSessionDetailResponse(matchedSession, matchedStudents),
        }),
      });
      return;
    }

    if (pathname.endsWith("/session") && request.method() === "POST") {
      const payload = request.postDataJSON() as CreateOrOpenFacultyAttendanceSessionPayloadDTO;
      state.saveRequests.push(payload);
      const matchingSession = findMatchingSession(state, payload);
      const normalizedStudents = applyPayloadStatuses(state.rosterStudents, payload);

      const session =
        matchingSession ??
        toCreatedSession(payload, "2026-04-16T10:00:00.000Z", SAVED_SESSION_ID);
      const isCreated = !matchingSession;

      if (state.existingSession?.id === session.id) {
        state.existingSessionStudents = normalizedStudents;
      } else {
        state.savedSession = session;
        state.savedSessionStudents = normalizedStudents;
      }

      const activeSessionStudents =
        state.existingSession?.id === session.id
          ? state.existingSessionStudents
          : state.savedSessionStudents;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: isCreated
            ? "Attendance session created successfully"
            : "Attendance session opened successfully",
          data: {
            session,
            created: isCreated,
            attendanceInitialization: {
              totalStudents: activeSessionStudents.length,
              presentCount: activeSessionStudents.filter(
                (student) => student.status === "PRESENT"
              ).length,
              absentCount: activeSessionStudents.filter(
                (student) => student.status === "ABSENT"
              ).length,
            },
          },
        }),
      });
      return;
    }

    if (
      request.method() === "DELETE" &&
      /\/faculty\/attendance\/session\/[^/]+$/.test(pathname)
    ) {
      const sessionId = decodeURIComponent(pathname.split("/").pop() || "");
      const targetSession =
        state.savedSession?.id === sessionId
          ? state.savedSession
          : state.existingSession?.id === sessionId
            ? state.existingSession
            : null;
      const targetStudents =
        state.savedSession?.id === sessionId
          ? state.savedSessionStudents
          : state.existingSession?.id === sessionId
            ? state.existingSessionStudents
            : null;

      if (!targetSession || !targetStudents) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            status: "error",
            message: "Attendance session not found",
            error: "Attendance session not found",
          }),
        });
        return;
      }

      if (state.savedSession?.id === sessionId) {
        state.savedSession = null;
        state.savedSessionStudents = [];
      } else {
        state.existingSession = null;
        state.existingSessionStudents = [];
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: "Attendance session deleted successfully",
          data: {
            sessionId,
            courseId: targetSession.courseId,
            affectedStudentCount: targetStudents.length,
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/session") && request.method() === "GET") {
      const pageValue = Number(searchParams.get("page") || "1");
      const limitValue = Number(searchParams.get("limit") || "10");
      const sessions = filterSessions(buildSessionList(state), searchParams);
      const paginated = toListResponse(
        sessions,
        Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
        Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 10
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: "Attendance sessions retrieved successfully",
          data: {
            items: paginated.items,
            pagination: paginated.pagination,
          },
        }),
      });
      return;
    }

    await route.continue();
  });
};
