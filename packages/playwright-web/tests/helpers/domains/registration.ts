import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  window: "/admin/registration-windows",
  toggle: (id: string) => `/admin/registration-windows/${id}/toggle`,
  dashboard: "/student/course-registration/dashboard",
  curriculum: "/student/course-registration/curriculum",
  submit: "/student/course-registration/submit",
  enrolled: "/student/course-registration/enrolled",
};

type WindowResponse = {
  status: string;
  data?: {
    id: string;
    academicTermId: string;
    semesterId: string;
    departmentId: string;
    isOpen: boolean;
  };
};

type CourseRegistrationResponse = {
  status: string;
  data?: {
    courseRegistrations: Array<{ id: string; courseId: string }>;
  };
};

export async function createRegistrationWindow(
  api: ApiHelper,
  data: {
    academicTermId: string;
    semesterId: string;
    departmentId: string;
    cycle?: "PHYSICS" | "CHEMISTRY" | "NONE";
    startDate: string;
    endDate: string;
  }
): Promise<{ id: string }> {
  const res = await api.post<WindowResponse>(
    PATHS.window,
    data as unknown as Record<string, unknown>
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(
      `Failed to create registration window: ${JSON.stringify(res)}`
    );
  }
  return { id: res.data.id };
}

export async function toggleRegistrationWindow(
  api: ApiHelper,
  windowId: string,
  open: boolean
): Promise<void> {
  const res = await api.patch<{ status: string }>(PATHS.toggle(windowId), {
    isOpen: open,
  });
  if (res.status !== "success") {
    throw new Error(
      `Failed to toggle registration window: ${JSON.stringify(res)}`
    );
  }
}

export async function submitCourseRegistration(
  api: ApiHelper,
  courseIds: string[]
): Promise<{ courseRegistrations: Array<{ id: string; courseId: string }> }> {
  const res = await api.post<CourseRegistrationResponse>(PATHS.submit, {
    courseIds,
  });
  if (res.status !== "success" || !res.data) {
    throw new Error(
      `Failed to submit course registration: ${JSON.stringify(res)}`
    );
  }
  return res.data;
}

export async function verifyRegistrationInDb(
  studentId: string,
  courseId: string
) {
  return testDb.courseRegistration.findFirst({
    where: { studentId, courseId },
  });
}
