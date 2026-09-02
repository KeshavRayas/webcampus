import { expect, test } from "@playwright/test";
import { createApiForRole } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  ensureApprovedCourse,
  ensureDepartment,
  ensureSection,
  ensureTerm,
  ensureUgSemester,
  grantPriorAttempt,
  makeStudent,
} from "./fixtures";

const PATHS = {
  candidates: "/admin/promotion/candidates",
  promote: "/admin/promotion",
  history: "/admin/promotion/history",
};

interface CandidatesResponse {
  status: string;
  data?: {
    fromSemester: { id: string; semesterNumber: number };
    toSemester: { id: string; semesterNumber: number };
    eligible: Array<{ studentId: string; usn: string }>;
    nonEligible: Array<{
      studentId: string;
      usn: string;
      reasons: string[];
      outstandingBacklogs: Array<{
        courseId: string;
        courseCode: string;
        outcome: string;
      }>;
    }>;
  };
}

interface HistoryResponse {
  status: string;
  data?: {
    data: Array<{
      id: string;
      fromSemesterNumber: number;
      toSemesterNumber: number;
      student: { usn: string };
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

function uniqueSuffix(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function setupBase() {
  const department = await ensureDepartment();
  const currentTerm = await ensureTerm("odd", "2026");
  const priorTerm = await ensureTerm("even", "2025");
  return { department, currentTerm, priorTerm };
}

test.setTimeout(300000);

test("Promotion moves selected students and leaves unselected behind", async ({
  browser,
}) => {
  const suffix = uniqueSuffix("s5");
  const { department, currentTerm } = await setupBase();
  const currentSem2 = await ensureUgSemester(currentTerm.id, 2);
  const currentSem3 = await ensureUgSemester(currentTerm.id, 3);
  const section = await ensureSection(
    department.id,
    department.name,
    currentSem2.id,
    `BLG-SEC-${suffix}`
  );

  const selected = await makeStudent(browser, {
    suffix: `${suffix}a`,
    term: currentTerm,
    semesterId: currentSem2.id,
    semesterNumber: 2,
    sectionId: section.id,
  });
  const unselected = await makeStudent(browser, {
    suffix: `${suffix}b`,
    term: currentTerm,
    semesterId: currentSem2.id,
    semesterNumber: 2,
    sectionId: section.id,
  });

  const adminApi = await createApiForRole(browser, "admin");

  const candidates = await adminApi.get<CandidatesResponse>(
    `${PATHS.candidates}?fromSemesterId=${currentSem2.id}&toSemesterId=${currentSem3.id}`
  );
  expect(candidates.status).toBe("success");
  const eligibleIds = (candidates.data?.eligible ?? []).map(
    (item) => item.studentId
  );
  expect(eligibleIds).toContain(selected.studentId);
  expect(eligibleIds).toContain(unselected.studentId);

  await adminApi.post(PATHS.promote, {
    fromSemesterId: currentSem2.id,
    toSemesterId: currentSem3.id,
    studentIds: [selected.studentId],
  });

  const promotedStudent = await testDb.student.findUniqueOrThrow({
    where: { id: selected.studentId },
  });
  expect(promotedStudent.currentSemester).toBe(3);
  expect(promotedStudent.semesterId).toBe(currentSem3.id);
  expect(promotedStudent.academicTermId).toBe(currentTerm.id);

  const stayedStudent = await testDb.student.findUniqueOrThrow({
    where: { id: unselected.studentId },
  });
  expect(stayedStudent.currentSemester).toBe(2);
  expect(stayedStudent.semesterId).toBe(currentSem2.id);

  const historyQuery = new URLSearchParams({
    studentId: selected.studentId,
    page: "1",
    pageSize: "20",
  });
  const history = await adminApi.get<HistoryResponse>(
    `${PATHS.history}?${historyQuery.toString()}`
  );
  expect(history.data?.total).toBeGreaterThanOrEqual(1);
  const row = history.data?.data.find(
    (item) => item.student.usn === selected.usn
  );
  expect(row?.fromSemesterNumber).toBe(2);
  expect(row?.toSemesterNumber).toBe(3);
});

test("Backlog carrier is promotable without auto-registration", async ({
  browser,
}) => {
  const suffix = uniqueSuffix("s6");
  const { department, currentTerm, priorTerm } = await setupBase();
  const priorSem2 = await ensureUgSemester(priorTerm.id, 2);
  const currentSem2 = await ensureUgSemester(currentTerm.id, 2);
  const currentSem3 = await ensureUgSemester(currentTerm.id, 3);
  const section = await ensureSection(
    department.id,
    department.name,
    currentSem2.id,
    `BLG-SEC-${suffix}`
  );
  const course = await ensureApprovedCourse({
    suffix,
    departmentId: department.id,
    semesterId: priorSem2.id,
  });

  const carrier = await makeStudent(browser, {
    suffix,
    term: currentTerm,
    semesterId: currentSem2.id,
    semesterNumber: 2,
    sectionId: section.id,
  });
  const priorAttempt = await grantPriorAttempt({
    studentId: carrier.studentId,
    courseId: course.id,
    semesterId: priorSem2.id,
    academicTermId: priorTerm.id,
    outcome: "F",
  });

  const adminApi = await createApiForRole(browser, "admin");

  const candidates = await adminApi.get<CandidatesResponse>(
    `${PATHS.candidates}?fromSemesterId=${currentSem2.id}&toSemesterId=${currentSem3.id}`
  );
  const flagged = candidates.data?.nonEligible.find(
    (item) => item.studentId === carrier.studentId
  );
  expect(flagged?.reasons).toContain("HAS_OUTSTANDING_BACKLOGS");
  expect(
    flagged?.outstandingBacklogs.some((item) => item.courseId === course.id)
  ).toBe(true);

  await adminApi.post(PATHS.promote, {
    fromSemesterId: currentSem2.id,
    toSemesterId: currentSem3.id,
    studentIds: [carrier.studentId],
  });

  const promoted = await testDb.student.findUniqueOrThrow({
    where: { id: carrier.studentId },
  });
  expect(promoted.currentSemester).toBe(3);
  expect(promoted.semesterId).toBe(currentSem3.id);

  const registrations = await testDb.courseRegistration.findMany({
    where: { studentId: carrier.studentId },
  });
  expect(registrations).toHaveLength(1);
  expect(registrations[0]?.id).toBe(priorAttempt.id);
  expect(registrations[0]?.registrationType).toBe("REGULAR");
});
