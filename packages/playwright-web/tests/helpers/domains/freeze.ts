import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  facultyFreeze: "/faculty/freeze/toggle",
  hodFreeze: "/hod/freeze/toggle",
  adminFreeze: "/admin/freeze/toggle",
  check: "/faculty/freeze/status",
};

type FreezeResponse = {
  status: string;
  data?: {
    courseAssignmentId: string;
    facultyFrozen: boolean;
    hodFrozen: boolean;
    adminFrozen: boolean;
  };
};

export async function facultyFreezeToggle(
  api: ApiHelper,
  courseAssignmentId: string,
  frozen: boolean
): Promise<void> {
  const res = await api.patch<FreezeResponse>(PATHS.facultyFreeze, {
    courseAssignmentId,
    frozen,
  });
  if (res.status !== "success") {
    throw new Error(`Faculty freeze toggle failed: ${JSON.stringify(res)}`);
  }
}

export async function hodFreezeToggle(
  api: ApiHelper,
  courseAssignmentId: string,
  frozen: boolean
): Promise<void> {
  const res = await api.patch<FreezeResponse>(PATHS.hodFreeze, {
    courseAssignmentId,
    frozen,
  });
  if (res.status !== "success") {
    throw new Error(`HOD freeze toggle failed: ${JSON.stringify(res)}`);
  }
}

export async function adminFreezeToggle(
  api: ApiHelper,
  courseAssignmentId: string,
  frozen: boolean
): Promise<void> {
  const res = await api.patch<FreezeResponse>(PATHS.adminFreeze, {
    courseAssignmentId,
    frozen,
  });
  if (res.status !== "success") {
    throw new Error(`Admin freeze toggle failed: ${JSON.stringify(res)}`);
  }
}

export async function verifyFreezeInDb(courseAssignmentId: string) {
  return testDb.freeze.findUnique({
    where: { courseAssignmentId },
    select: {
      id: true,
      courseAssignmentId: true,
      facultyFrozen: true,
      hodFrozen: true,
      adminFrozen: true,
    },
  });
}
