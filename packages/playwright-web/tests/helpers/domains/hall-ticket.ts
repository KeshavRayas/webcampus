import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  adminList: "/admin/hall-ticket",
  adminSend: "/admin/hall-ticket/send",
  adminUnsend: "/admin/hall-ticket/unsend",
  adminPreview: (studentId: string, termId: string) =>
    `/admin/hall-ticket/${studentId}/${termId}`,
  adminPdf: (studentId: string, termId: string) =>
    `/admin/hall-ticket/${studentId}/${termId}/pdf`,
  studentList: "/student/hall-ticket",
  studentView: (termId: string) => `/student/hall-ticket/${termId}`,
  studentPdf: (termId: string) => `/student/hall-ticket/${termId}/pdf`,
};

type ApiResponse<T> = {
  status: string;
  data?: T;
};

type HallTicketStudent = {
  studentId: string;
  usn: string;
  name: string;
  departmentName: string;
  currentSemester: number;
  programType: string;
  allCoursesFrozen: boolean;
  courses: Array<{
    courseId: string;
    courseName: string;
    courseCode: string;
    eligible: boolean;
    markEligible: boolean;
    attendanceEligible: boolean;
    isFrozen: boolean;
  }>;
};

type SendResponse = {
  status: string;
  data?: {
    count: number;
  };
};

export async function listEligibleStudents(
  api: ApiHelper,
  params: {
    academicTermId: string;
    semesterId: string;
    departmentId?: string;
  }
): Promise<Array<HallTicketStudent>> {
  const query = new URLSearchParams({
    academicTermId: params.academicTermId,
    semesterId: params.semesterId,
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
  });
  const res = await api.get<
    ApiResponse<{ students: Array<HallTicketStudent> }>
  >(`${PATHS.adminList}?${query}`);
  if (res.status !== "success" || !res.data) {
    throw new Error(
      `Failed to list hall ticket students: ${JSON.stringify(res)}`
    );
  }
  return res.data.students;
}

export async function sendHallTickets(
  api: ApiHelper,
  studentIds: string[],
  academicTermId: string,
  semesterId: string
): Promise<number> {
  const res = await api.post<SendResponse>(PATHS.adminSend, {
    studentIds,
    academicTermId,
    semesterId,
  });
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to send hall tickets: ${JSON.stringify(res)}`);
  }
  return res.data.count;
}

export async function previewHallTicket(
  api: ApiHelper,
  studentId: string,
  termId: string
): Promise<HallTicketStudent> {
  const res = await api.get<ApiResponse<HallTicketStudent>>(
    PATHS.adminPreview(studentId, termId)
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to preview hall ticket: ${JSON.stringify(res)}`);
  }
  return res.data;
}

export async function verifyHallTicketInDb(studentId: string, termId: string) {
  return testDb.hallTicket.findFirst({
    where: { studentId, academicTermId: termId },
  });
}
