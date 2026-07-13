import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  shell: "/admission/shell",
  submit: "/admission/submit",
  approve: (id: string) => `/admission/${id}/approve`,
  reject: (id: string) => `/admission/${id}/reject`,
  port: "/admission/port",
  me: "/admission/me",
  departments: "/admission/departments",
};

type AdmissionShellResponse = {
  status: string;
  data?: {
    id: string;
    applicationId: string;
    tempUsn: string;
    status: string;
  };
};

type AdmissionSubmitResponse = {
  status: string;
  data?: {
    id: string;
    applicationId: string;
    status: string;
  };
};

type PortResponse = {
  status: string;
  data?: {
    semesterId: string;
    semesterNumber: number;
    totalApproved: number;
    newlyPorted: number;
    alreadyPorted: number;
    failedPorts: Array<{ applicationId: string; reason: string }>;
    autoCreatedApplicants: number;
    rejectedCount: number;
  };
};

export type CreateShellInput = {
  applicationId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  modeOfAdmission: string;
  semesterId: string;
  departmentId: string;
  categoryClaimed: string;
  categoryAllotted: string;
  quota: string;
};

let _seq = 0;

export function makeShellInput(
  departmentId: string,
  semesterId: string,
  overrides: Partial<CreateShellInput> = {}
): CreateShellInput {
  _seq++;
  const ts = Date.now().toString(36).slice(-6);
  const seq = String(_seq).padStart(4, "0");
  return {
    applicationId: `APP${ts}${seq}`,
    firstName: `Test${seq}`,
    lastName: `Applicant${seq}`,
    modeOfAdmission: "CET",
    semesterId,
    departmentId,
    categoryClaimed: "GENERAL",
    categoryAllotted: "GENERAL",
    quota: "MANAGEMENT",
    ...overrides,
  };
}

export async function createAdmissionShell(
  api: ApiHelper,
  input: CreateShellInput
): Promise<{ id: string; applicationId: string; tempUsn: string }> {
  const res = await api.post<AdmissionShellResponse>(
    PATHS.shell,
    input as unknown as Record<string, unknown>
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to create admission shell: ${JSON.stringify(res)}`);
  }
  return {
    id: res.data.id,
    applicationId: res.data.applicationId,
    tempUsn: res.data.tempUsn,
  };
}

export async function submitAdmission(
  api: ApiHelper,
  data: Record<string, unknown>
): Promise<{ id: string; applicationId: string }> {
  const res = await api.post<AdmissionSubmitResponse>(PATHS.submit, data);
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to submit admission: ${JSON.stringify(res)}`);
  }
  return { id: res.data.id, applicationId: res.data.applicationId };
}

export async function approveAdmission(
  api: ApiHelper,
  admissionId: string
): Promise<void> {
  const res = await api.patch<{ status: string }>(PATHS.approve(admissionId));
  if (res.status !== "success") {
    throw new Error(`Failed to approve admission: ${JSON.stringify(res)}`);
  }
}

export async function portStudents(
  api: ApiHelper,
  semesterId: string
): Promise<PortResponse["data"]> {
  const res = await api.post<PortResponse>(PATHS.port, { semesterId });
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to port students: ${JSON.stringify(res)}`);
  }
  return res.data;
}

export async function verifyStudentInDb(usn: string) {
  const student = await testDb.student.findUnique({
    where: { usn },
    include: { user: true },
  });
  return student;
}

export async function createAndPortStudent(
  api: ApiHelper,
  dept: { id: string },
  semester: { id: string }
): Promise<{ studentId: string; usn: string }> {
  const shellInput = makeShellInput(dept.id, semester.id);
  const shell = await createAdmissionShell(api, shellInput);

  await testDb.admission.update({
    where: { id: shell.id },
    data: { status: "SUBMITTED" },
  });

  await approveAdmission(api, shell.id);
  await portStudents(api, semester.id);

  const admissionRecord = await testDb.admission.findUnique({
    where: { id: shell.id },
    select: { studentId: true },
  });
  if (!admissionRecord?.studentId) {
    throw new Error(`Student ID not set on admission after porting`);
  }

  const student = await testDb.student.findUnique({
    where: { id: admissionRecord.studentId },
  });
  if (!student) {
    throw new Error(
      `Student not found after porting (id=${admissionRecord.studentId})`
    );
  }

  return { studentId: student.id, usn: student.usn };
}
