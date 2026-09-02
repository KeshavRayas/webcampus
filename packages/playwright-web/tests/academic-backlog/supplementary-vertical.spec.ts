import { expect, test } from "@playwright/test";
import { createApiForRole } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  ensureAdminUserId,
  ensureApprovedCourse,
  ensureDepartment,
  ensureSection,
  ensureTerm,
  ensureUgSemester,
  grantPriorAttempt,
  makeStudent,
  openRegistrationWindow,
  type StudentFixture,
} from "./fixtures";

const PATHS = {
  suppEligible: "/student/supplementary/eligible",
  suppSubmit: "/student/supplementary/submit",
  suppOfferings: "/admin/supplementary/offerings",
};
function uniqueSuffix(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}`;
}
interface EligibilityResponse {
  status: string;
  data?: {
    isOpen: boolean;
    candidates: Array<{
      courseId: string;
      code: string;
      eligible: boolean;
      reasons: string[];
    }>;
  };
}
test("Supplementary registration places only registered students into per-course sections", async ({
  browser,
}) => {
  test.setTimeout(300000);
  const suffix = uniqueSuffix("spv");
  const department = await ensureDepartment();
  const currentTerm = await ensureTerm("odd", "2026");
  const priorTerm = await ensureTerm("even", "2025");
  const suppTerm = await ensureTerm("supplementary", `2026${suffix.slice(-8)}`);
  const priorSem1 = await ensureUgSemester(priorTerm.id, 1);
  const currentSem3 = await ensureUgSemester(currentTerm.id, 3);
  const suppHostSem1 = await ensureUgSemester(suppTerm.id, 1);
  const s3Section = await ensureSection(
    department.id,
    department.name,
    currentSem3.id,
    `SPV-S3-${suffix}`
  );
  const cse101 = await ensureApprovedCourse({
    suffix: `${suffix}cs`,
    departmentId: department.id,
    semesterId: priorSem1.id,
    totalCredits: 5,
  });
  const mat102 = await ensureApprovedCourse({
    suffix: `${suffix}ma`,
    departmentId: department.id,
    semesterId: priorSem1.id,
    totalCredits: 6,
  });
  const heavy = await ensureApprovedCourse({
    suffix: `${suffix}hv`,
    departmentId: department.id,
    semesterId: priorSem1.id,
    totalCredits: 17,
  });
  const phy103 = await ensureApprovedCourse({
    suffix: `${suffix}ph`,
    departmentId: department.id,
    semesterId: priorSem1.id,
    totalCredits: 4,
  });
  async function makeBacklogStudent(tag: string): Promise<StudentFixture> {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await makeStudent(browser, {
          suffix: `${suffix}${tag}`,
          term: currentTerm,
          semesterId: currentSem3.id,
          semesterNumber: 3,
          sectionId: s3Section.id,
        });
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20000));
      }
    }
    throw new Error(`Could not create student ${tag}`);
  }
  const studentA = await makeBacklogStudent("a");
  const studentB = await makeBacklogStudent("b");
  const studentC = await makeBacklogStudent("c");
  const studentD = await makeBacklogStudent("d");
  const studentF = await makeBacklogStudent("f");
  for (const [student, course] of [
    [studentA, cse101],
    [studentB, cse101],
    [studentB, mat102],
    [studentC, mat102],
    [studentD, cse101],
    [studentD, mat102],
    [studentD, heavy],
    [studentF, phy103],
  ] as const) {
    await grantPriorAttempt({
      studentId: student.studentId,
      courseId: course.id,
      semesterId: priorSem1.id,
      academicTermId: priorTerm.id,
      outcome: "NE",
    });
  }
  const aS3Registration = await testDb.courseRegistration.create({
    data: {
      studentId: studentA.studentId,
      courseId: (
        await ensureApprovedCourse({
          suffix: `${suffix}s3`,
          departmentId: department.id,
          semesterId: currentSem3.id,
        })
      ).id,
      semesterId: currentSem3.id,
      academicTermId: currentTerm.id,
    },
  });
  const adminApi = await createApiForRole(browser, "admin");
  const cseOffering = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(PATHS.suppOfferings, { academicTermId: suppTerm.id, courseId: cse101.id });
  expect(cseOffering.status).toBe("success");
  const matOffering = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(PATHS.suppOfferings, { academicTermId: suppTerm.id, courseId: mat102.id });
  const heavyOffering = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(PATHS.suppOfferings, {
    academicTermId: suppTerm.id,
    courseId: heavy.id,
  });
  expect(heavyOffering.status).toBe("success");
  expect(matOffering.status).toBe("success");
  const facultyForSup = await testDb.faculty.findFirstOrThrow({
    where: { departmentId: department.id },
    select: { id: true },
  });
  const cseSection = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(`${PATHS.suppOfferings}/${cseOffering.data?.id}/sections`, {
    name: `SUP-CSE-${suffix}`,
    facultyId: facultyForSup.id,
  });
  expect(cseSection.status).toBe("success");
  const matSection = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(`${PATHS.suppOfferings}/${matOffering.data?.id}/sections`, {
    name: `SUP-MAT-${suffix}`,
    facultyId: facultyForSup.id,
  });
  expect(matSection.status).toBe("success");
  await expect(
    studentA.api.post(PATHS.suppSubmit, { courseIds: [cse101.id] })
  ).rejects.toThrow(/window is closed/i);
  await expect(
    studentF.api.post(PATHS.suppSubmit, { courseIds: [phy103.id] })
  ).rejects.toThrow(/not offered/i);

  await openRegistrationWindow(adminApi, {
    registrationType: "SUPPLEMENTARY",
    academicTermId: suppTerm.id,
    semesterId: suppHostSem1.id,
  });
  const eligible = await studentA.api.get<EligibilityResponse>(
    PATHS.suppEligible
  );
  expect(eligible.status).toBe("success");
  expect(eligible.data?.isOpen).toBe(true);
  const cseCandidate = eligible.data?.candidates.find(
    (item) => item.courseId === cse101.id
  );
  expect(cseCandidate?.eligible).toBe(true);
  const submittedA = await studentA.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.suppSubmit, { courseIds: [cse101.id] });
  expect(submittedA.status).toBe("success");
  expect(submittedA.data?.count).toBe(1);
  const submittedB = await studentB.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.suppSubmit, { courseIds: [cse101.id, mat102.id] });
  expect(submittedB.status).toBe("success");
  expect(submittedB.data?.count).toBe(2);
  const submittedC = await studentC.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.suppSubmit, { courseIds: [mat102.id] });
  expect(submittedC.status).toBe("success");
  expect(submittedC.data?.count).toBe(1);

  await expect(
    studentD.api.post(PATHS.suppSubmit, { courseIds: [heavy.id] })
  ).rejects.toThrow(/credit/i);

  const submittedD = await studentD.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.suppSubmit, { courseIds: [cse101.id] });
  expect(submittedD.status).toBe("success");
  expect(submittedD.data?.count).toBe(1);

  await expect(
    studentA.api.post(PATHS.suppSubmit, { courseIds: [cse101.id] })
  ).rejects.toThrow(/No completed attempt|ALREADY_IN_PROGRESS/);

  const attemptRows = await testDb.courseRegistration.findMany({
    where: { studentId: studentA.studentId, courseId: cse101.id },
  });
  expect(attemptRows).toHaveLength(2);
  const suppRow = attemptRows.find(
    (row) => row.registrationType === "SUPPLEMENTARY"
  );
  const supersededRow = attemptRows.find((row) => row.id !== suppRow?.id);
  expect(supersededRow?.status).toBe("SUPERSEDED");
  expect(supersededRow?.registrationType).toBe("REGULAR");
  expect(suppRow?.status).toBe("ACTIVE");
  expect(suppRow?.academicTermId).toBe(suppTerm.id);
  expect(suppRow?.semesterId).toBe(priorSem1.id);
  expect(suppRow?.sourceRegistrationId).toBe(supersededRow?.id);
  const aS3After = await testDb.courseRegistration.findUniqueOrThrow({
    where: { id: aS3Registration.id },
  });
  expect(aS3After.status).toBe("ACTIVE");
  expect(aS3After.registrationType).toBe("REGULAR");
  const placedCse = await adminApi.post<{
    status: string;
    data?: { placedCount: number };
  }>(`/admin/supplementary/sections/${cseSection.data?.id}/students`, {
    studentIds: [studentA.studentId, studentB.studentId, studentD.studentId],
  });
  expect(placedCse.status).toBe("success");
  expect(placedCse.data?.placedCount).toBe(3);
  const placedMat = await adminApi.post<{
    status: string;
    data?: { placedCount: number };
  }>(`/admin/supplementary/sections/${matSection.data?.id}/students`, {
    studentIds: [studentB.studentId, studentC.studentId],
  });
  expect(placedMat.status).toBe("success");
  expect(placedMat.data?.placedCount).toBe(2);
  await expect(
    adminApi.post(
      `/admin/supplementary/sections/${matSection.data?.id}/students`,
      { studentIds: [studentF.studentId] }
    )
  ).rejects.toThrow(/without an active supplementary registration/i);
  const cseMembers = await testDb.studentSection.findMany({
    where: { sectionId: cseSection.data?.id },
    select: { studentId: true },
  });
  expect(cseMembers.map((member) => member.studentId).sort()).toEqual(
    [studentA.studentId, studentB.studentId, studentD.studentId].sort()
  );
  const matMembers = await testDb.studentSection.findMany({
    where: { sectionId: matSection.data?.id },
    select: { studentId: true },
  });
  expect(matMembers.map((member) => member.studentId).sort()).toEqual(
    [studentB.studentId, studentC.studentId].sort()
  );
  for (const [student, course, expected] of [
    [studentA, cse101, 1],
    [studentB, cse101, 1],
    [studentB, mat102, 1],
    [studentC, mat102, 1],
    [studentD, cse101, 1],
  ] as const) {
    const rows = await testDb.courseRegistration.findMany({
      where: {
        studentId: student.studentId,
        courseId: course.id,
        registrationType: "SUPPLEMENTARY",
        status: "ACTIVE",
      },
    });
    expect(rows).toHaveLength(expected);
  }
  const aInMat = await testDb.studentSection.findFirst({
    where: { sectionId: matSection.data?.id, studentId: studentA.studentId },
  });
  expect(aInMat).toBeNull();
  const cInCse = await testDb.studentSection.findFirst({
    where: { sectionId: cseSection.data?.id, studentId: studentC.studentId },
  });
  expect(cInCse).toBeNull();
});

test("supplementary term provisioning via admin API persists dates and rejects duplicates", async ({
  browser,
}) => {
  test.setTimeout(300000);
  const suffix = `${Date.now().toString(36)}t`;
  const adminApi = await createApiForRole(browser, "admin");
  const suppYear = `2026${suffix}`;
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const termRes = await adminApi.post<{
    status: string;
    message?: string;
    data?: { id: string };
  }>(`/admin/semester`, {
    type: "supplementary",
    parity: "odd",
    year: suppYear,
    isCurrent: false,
    startDate,
    endDate,
  });
  expect(termRes.status).toBe("success");
  await expect(
    adminApi.post(`/admin/semester`, {
      type: "supplementary",
      parity: "odd",
      year: suppYear,
      isCurrent: false,
    })
  ).rejects.toThrow(/already exists/i);

  const suppTermRow = await testDb.academicTerm.findFirstOrThrow({
    where: { type: "supplementary", year: suppYear, parity: "odd" },
  });
  expect(suppTermRow.startDate).not.toBeNull();
  expect(suppTermRow.endDate).not.toBeNull();

  const adminUserId = await ensureAdminUserId();
  const routeRes = await adminApi.put<{ status: string; message?: string }>(
    `/admin/semester/${suppTermRow.id}/semesters`,
    [
      {
        academicTermId: suppTermRow.id,
        programType: "UG",
        semesterNumber: 1,
        termType: "supplementary",
        startDate,
        endDate,
        userId: adminUserId,
      },
    ]
  );
  expect(routeRes.status).toBe("success");
  const routedSem1 = await testDb.semester.findFirstOrThrow({
    where: { academicTermId: suppTermRow.id, semesterNumber: 1 },
  });
  expect(routedSem1.startDate).not.toBeNull();
});
