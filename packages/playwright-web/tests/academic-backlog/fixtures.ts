import type { Browser, BrowserContext } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";

const PASSWORD = "password";
const DEPARTMENT_NAME = "Computer Science and Engineering";
const ACADEMIC_YEAR = "2025-26";

export function resolveApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
}

function frontendOrigin(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:3000";
}

export async function ensureDepartment() {
  const department = await testDb.department.findFirst({
    where: { name: DEPARTMENT_NAME },
  });
  if (!department) {
    throw new Error(`Department "${DEPARTMENT_NAME}" not found`);
  }
  return department;
}

export async function ensureAdminUserId(): Promise<string> {
  const email =
    process.env.ADMIN_USER_EMAIL ??
    process.env.SEED_ADMIN_EMAIL ??
    "dev@webcampus.com";
  const user = await testDb.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Admin user "${email}" not found`);
  }
  return user.id;
}

export async function ensureTerm(
  type: "odd" | "even" | "supplementary",
  year: string,
  parity?: "odd" | "even"
) {
  const existing = await testDb.academicTerm.findFirst({
    where: {
      type,
      year,
      ...(type === "supplementary" ? { parity: parity ?? null } : {}),
    },
  });
  if (existing) return existing;
  return testDb.academicTerm.create({
    data: { type, year, ...(parity ? { parity } : {}) },
  });
}

export async function ensureSuppTerm(year: string, parity: "odd" | "even") {
  return ensureTerm("supplementary", year, parity);
}

export async function ensureUgSemester(
  academicTermId: string,
  semesterNumber: number
) {
  const creatorId = await ensureAdminUserId();
  const existing = await testDb.semester.findFirst({
    where: { academicTermId, programType: "UG", semesterNumber },
  });
  if (existing) return existing;
  const year = new Date().getFullYear();
  try {
    return await testDb.semester.create({
      data: {
        startDate: new Date(Date.UTC(year, 0, 1)),
        endDate: new Date(Date.UTC(year, 5, 30)),
        userId: creatorId,
        semesterNumber,
        academicTermId,
        programType: "UG",
      },
    });
  } catch {
    const raced = await testDb.semester.findFirst({
      where: { academicTermId, programType: "UG", semesterNumber },
    });
    if (!raced) throw new Error("Failed to create or find UG semester");
    return raced;
  }
}

export async function ensureSection(
  departmentId: string,
  departmentName: string,
  semesterId: string,
  name: string
) {
  const existing = await testDb.section.findFirst({
    where: { name, departmentId, semesterId },
  });
  if (existing) return existing;
  return testDb.section.create({
    data: { name, departmentId, departmentName, semesterId },
  });
}

export async function ensureApprovedCourse(options: {
  suffix: string;
  departmentId: string;
  semesterId: string;
  totalCredits?: number;
}) {
  const code = `BLG${options.suffix}`;
  const totalCredits = options.totalCredits ?? 5;
  const existing = await testDb.course.findUnique({ where: { code } });
  if (existing) return existing;
  return testDb.course.create({
    data: {
      code,
      name: `Backlog Course ${options.suffix}`,
      departmentId: options.departmentId,
      semesterId: options.semesterId,
      semesterNumber: 3,
      courseMode: "INTEGRATED",
      courseType: "PC",
      totalCredits,
      lectureCredits: totalCredits,
      approvalStatus: "APPROVED",
    },
  });
}

export interface StudentFixture {
  api: ApiHelper;
  context: BrowserContext;
  email: string;
  userId: string;
  studentId: string;
  usn: string;
}

export async function makeStudent(
  browser: Browser,
  options: {
    suffix: string;
    term: { id: string; type: "odd" | "even" | "supplementary"; year: string };
    semesterId: string;
    semesterNumber: number;
    sectionId: string;
  }
): Promise<StudentFixture> {
  const context = await browser.newContext();
  const email = `backlog-${options.suffix}@webcampus.test`;
  const usn = `BLGUSN${options.suffix}`;

  // better-auth rate-limits /sign-up to 10/min per IP; full-project runs burst
  // past that. Retry until the user row actually exists before continuing.
  let user = await testDb.user.findUnique({ where: { email } });
  for (let attempt = 0; attempt < 5 && !user; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }
    await context.request.post(
      `${resolveApiBaseUrl()}/api/auth/sign-up/email`,
      {
        headers: { Origin: frontendOrigin() },
        data: {
          email,
          password: PASSWORD,
          name: `Backlog Student ${options.suffix}`,
        },
      }
    );
    user = await testDb.user.findUnique({ where: { email } });
  }
  if (!user) {
    throw new Error(`Failed to sign up backlog student ${email}`);
  }
  await testDb.user.update({
    where: { id: user.id },
    data: { role: "student" },
  });

  let student = await testDb.student.findUnique({ where: { userId: user.id } });
  if (!student) {
    student = await testDb.student.create({
      data: {
        userId: user.id,
        usn,
        departmentName: DEPARTMENT_NAME,
        currentSemester: options.semesterNumber,
        academicYear: ACADEMIC_YEAR,
        academicTermId: options.term.id,
        academicTermLabel: `${options.term.type.charAt(0).toUpperCase()}${options.term.type.slice(1)} ${options.term.year}`,
        academicTermType: options.term.type,
        academicTermYear: options.term.year,
        programType: "UG",
        semesterId: options.semesterId,
        semesterNumber: options.semesterNumber,
      },
    });
  }
  await testDb.studentSection.create({
    data: {
      studentId: student.id,
      sectionId: options.sectionId,
      semester: options.semesterNumber,
      academicYear: ACADEMIC_YEAR,
    },
  });

  const signIn = await context.request.post(
    `${resolveApiBaseUrl()}/api/auth/sign-in/email`,
    {
      headers: { Origin: frontendOrigin() },
      data: { email, password: PASSWORD },
    }
  );
  if (!signIn.ok()) {
    throw new Error(`Student sign-in failed: ${signIn.status()}`);
  }

  return {
    api: new ApiHelper(context.request),
    context,
    email,
    userId: user.id,
    studentId: student.id,
    usn,
  };
}

export async function grantPriorAttempt(options: {
  studentId: string;
  courseId: string;
  semesterId: string;
  academicTermId: string;
  outcome: "F" | "NE" | "P" | "X";
}) {
  const registration = await testDb.courseRegistration.create({
    data: {
      studentId: options.studentId,
      courseId: options.courseId,
      semesterId: options.semesterId,
      academicTermId: options.academicTermId,
    },
  });
  await testDb.examRegistration.create({
    data: {
      studentId: options.studentId,
      courseId: options.courseId,
      academicTermId: options.academicTermId,
      examType: "REGULAR",
      attemptNumber: 1,
      status: "RESULT_DECLARED",
      outcome: options.outcome,
      eligibleAtRegistration:
        options.outcome === "F" || options.outcome === "X",
      sourceCourseRegistrationId: registration.id,
    },
  });
  return registration;
}

interface WindowListItem {
  id: string;
  departmentId: string | null;
  cycle: string | null;
  registrationType: string;
  isOpen: boolean;
}

async function toggleWindow(api: ApiHelper, windowId: string, isOpen: boolean) {
  await api.patch(`/admin/registration-windows/${windowId}/toggle`, { isOpen });
}

export async function ensureRegistrationWindow(
  adminApi: ApiHelper,
  options: {
    registrationType: "REGULAR" | "RE_REGISTRATION" | "SUPPLEMENTARY";
    academicTermId: string;
    semesterId: string;
    departmentId?: string;
    open: boolean;
  }
): Promise<string> {
  const query = new URLSearchParams({
    academicTermId: options.academicTermId,
    semesterId: options.semesterId,
    registrationType: options.registrationType,
  });
  const res = await adminApi.get<{ status: string; data?: WindowListItem[] }>(
    `/admin/registration-windows?${query.toString()}`
  );
  const existing = res.data?.find(
    (item) => item.departmentId === options.departmentId
  );
  if (existing) {
    if (existing.isOpen !== options.open) {
      await toggleWindow(adminApi, existing.id, options.open);
    }
    return existing.id;
  }

  const created = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>("/admin/registration-windows", {
    registrationType: options.registrationType,
    academicTermId: options.academicTermId,
    semesterId: options.semesterId,
    departmentId: options.departmentId,
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (created.status !== "success" || !created.data) {
    throw new Error(`Failed to create window: ${JSON.stringify(created)}`);
  }
  if (!options.open) {
    return created.data.id;
  }
  await toggleWindow(adminApi, created.data.id, true);
  return created.data.id;
}

export async function openRegistrationWindow(
  adminApi: ApiHelper,
  options: {
    registrationType: "REGULAR" | "RE_REGISTRATION" | "SUPPLEMENTARY";
    academicTermId: string;
    semesterId: string;
    departmentId?: string;
  }
): Promise<string> {
  return ensureRegistrationWindow(adminApi, { ...options, open: true });
}
