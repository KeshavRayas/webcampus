import { expect, test } from "@playwright/test";
import { ApiHelper, createApiForRole } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
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
  suppOfferings: "/admin/supplementary/offerings",
  suppSubmit: "/student/supplementary/submit",
  roster: "/faculty/attendance/session/students",
  session: "/faculty/attendance/session",
  saveMarks: "/faculty/marks/assessments/save-marks",
  upsertMapping: "/admin/course-assignment/upsert",
};
const TIMING_SLOTS = [
  "08:00-08:55",
  "08:55-09:50",
  "09:50-10:45",
  "11:15-12:10",
  "12:10-13:05",
  "14:00-14:55",
  "14:55-15:50",
  "15:50-16:45",
];
interface RosterResponse {
  status: string;
  data?: {
    students: Array<{ studentId: string }>;
  };
}
test("Supplementary teaching flow pins attendance and CIE to supplementary attempts", async ({
  browser,
}) => {
  test.setTimeout(300000);
  const suffix = `${Date.now().toString(36)}t`;
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
  const origin = process.env.FRONTEND_URL ?? "http://localhost:3000";

  const department = await ensureDepartment();
  const currentTerm = await ensureTerm("odd", "2026");
  const priorTerm = await ensureTerm("even", "2025");
  const suppTerm = await ensureTerm("supplementary", `2026${suffix}`);
  const priorSem1 = await ensureUgSemester(priorTerm.id, 1);
  const currentSem3 = await ensureUgSemester(currentTerm.id, 3);
  const suppHostSem1 = await ensureUgSemester(suppTerm.id, 1);
  const s3Section = await ensureSection(
    department.id,
    department.name,
    currentSem3.id,
    `SPT-S3-${suffix}`
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
  for (const course of [cse101, mat102]) {
    await testDb.course.update({
      where: { id: course.id },
      data: {
        theoryMaxExams: 1,
        theoryMinExams: 1,
        theoryExamMaxMarks: 20,
        cieMaxMarks: 20,
        theoryCieContribution: 100,
        theoryEligibility: 35,
      },
    });
  }
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

  for (const [student, course] of [
    [studentA, cse101],
    [studentB, cse101],
    [studentB, mat102],
    [studentC, mat102],
  ] as const) {
    await grantPriorAttempt({
      studentId: student.studentId,
      courseId: course.id,
      semesterId: priorSem1.id,
      academicTermId: priorTerm.id,
      outcome: "NE",
    });
  }
  const s3Registration = await testDb.courseRegistration.create({
    data: {
      studentId: studentB.studentId,
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

  const cseTemplate = await testDb.assessmentTemplate.create({
    data: {
      courseId: cse101.id,
      semesterId: cse101.semesterId,
      title: `CIE1-${suffix}`,
      totalMarks: 20,
      componentType: "THEORY",
      sequence: 1,
    },
  });
  const matTemplate = await testDb.assessmentTemplate.create({
    data: {
      courseId: mat102.id,
      semesterId: mat102.semesterId,
      title: `CIE1-${suffix}`,
      totalMarks: 20,
      componentType: "THEORY",
      sequence: 1,
    },
  });

  const originalCse = await testDb.courseRegistration.findFirstOrThrow({
    where: {
      studentId: studentB.studentId,
      courseId: cse101.id,
      registrationType: "REGULAR",
    },
  });
  const legacyMark = await testDb.mark.create({
    data: {
      studentId: studentB.studentId,
      courseId: cse101.id,
      cieTotal: 12.5,
      status: "NOT_ELIGIBLE",
      courseRegistrationId: originalCse.id,
    },
  });
  const legacyAssessment = await testDb.studentAssessment.create({
    data: {
      studentId: studentB.studentId,
      assessmentId: cseTemplate.id,
      courseId: cse101.id,
      totalMarks: 5,
      status: "ABSENT",
      courseRegistrationId: originalCse.id,
    },
  });
  const legacyAttendance = await testDb.attendance.create({
    data: {
      studentId: studentB.studentId,
      courseId: cse101.id,
      total: 10,
      present: 8,
      absent: 2,
      percentage: 80,
      courseRegistrationId: originalCse.id,
    },
  });

  const adminApi = await createApiForRole(browser, "admin");
  const facultyXProfile = await testDb.faculty.findFirstOrThrow({
    where: { user: { email: "faculty.cs@webcampus.com" } },
    select: {
      id: true,
      designation: true,
      shortName: true,
      departmentId: true,
    },
  });
  const yEmail = `faculty.y.${suffix}@webcampus.test`;
  const yContext = await browser.newContext();
  await yContext.request.post(`${apiBase}/api/auth/sign-up/email`, {
    data: { email: yEmail, password: "password", name: "Faculty Y" },
    headers: { Origin: origin },
  });
  const yUser = await testDb.user.update({
    where: { email: yEmail },
    data: { role: "faculty" },
  });
  const facultyYProfile = await testDb.faculty.create({
    data: {
      userId: yUser.id,
      departmentId: department.id,
      designation: facultyXProfile.designation,
      shortName: `FY${suffix.slice(-5)}`,
    },
  });
  await yContext.request.post(`${apiBase}/api/auth/sign-in/email`, {
    data: { email: yEmail, password: "password" },
    headers: { Origin: origin },
  });
  const facultyYApi = new ApiHelper(yContext.request);

  const cseOffering = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(PATHS.suppOfferings, { academicTermId: suppTerm.id, courseId: cse101.id });
  const matOffering = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(PATHS.suppOfferings, { academicTermId: suppTerm.id, courseId: mat102.id });
  expect(cseOffering.status).toBe("success");
  expect(matOffering.status).toBe("success");
  const cseSection = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(`${PATHS.suppOfferings}/${cseOffering.data?.id}/sections`, {
    name: `SUP-CSE-${suffix}`,
    facultyId: facultyXProfile.id,
  });
  const matSection = await adminApi.post<{
    status: string;
    data?: { id: string };
  }>(`${PATHS.suppOfferings}/${matOffering.data?.id}/sections`, {
    name: `SUP-MAT-${suffix}`,
    facultyId: facultyYProfile.id,
  });
  expect(cseSection.status).toBe("success");
  expect(matSection.status).toBe("success");

  await openRegistrationWindow(adminApi, {
    registrationType: "SUPPLEMENTARY",
    academicTermId: suppTerm.id,
    semesterId: suppHostSem1.id,
  });
  const submittedA = await studentA.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.suppSubmit, { courseIds: [cse101.id] });
  const submittedB = await studentB.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.suppSubmit, { courseIds: [cse101.id, mat102.id] });
  const submittedC = await studentC.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.suppSubmit, { courseIds: [mat102.id] });
  expect(submittedA.data?.count).toBe(1);
  expect(submittedB.data?.count).toBe(2);
  expect(submittedC.data?.count).toBe(1);

  const placements: [string, string[]][] = [
    [cseSection.data?.id as string, [studentA.studentId, studentB.studentId]],
    [matSection.data?.id as string, [studentB.studentId, studentC.studentId]],
  ];
  for (const [sectionId, ids] of placements) {
    const placed = await adminApi.post<{
      status: string;
      data?: { placedCount: number };
    }>(`/admin/supplementary/sections/${sectionId}/students`, {
      studentIds: ids,
    });
    expect(placed.data?.placedCount).toBe(ids.length);
  }

  async function activeSuppRow(studentId: string, courseId: string) {
    return testDb.courseRegistration.findFirstOrThrow({
      where: {
        studentId,
        courseId,
        registrationType: "SUPPLEMENTARY",
        status: "ACTIVE",
      },
    });
  }
  const suppACse = await activeSuppRow(studentA.studentId, cse101.id);
  const suppBCse = await activeSuppRow(studentB.studentId, cse101.id);
  const suppBMat = await activeSuppRow(studentB.studentId, mat102.id);
  const suppCMat = await activeSuppRow(studentC.studentId, mat102.id);

  const cseRoster = await (
    await createApiForRole(browser, "faculty")
  ).get<RosterResponse>(
    `${PATHS.roster}?courseId=${cse101.id}&sectionId=${cseSection.data?.id}`
  );
  expect(cseRoster.status).toBe("success");
  const cseRosterIds = (cseRoster.data?.students ?? []).map((s) => s.studentId);
  expect(cseRosterIds).toEqual([studentA.studentId, studentB.studentId]);
  const matRoster = await facultyYApi.get<RosterResponse>(
    `${PATHS.roster}?courseId=${mat102.id}&sectionId=${matSection.data?.id}`
  );
  expect(matRoster.status).toBe("success");
  const matRosterIds = (matRoster.data?.students ?? []).map((s) => s.studentId);
  expect(matRosterIds).toEqual([studentB.studentId, studentC.studentId]);
  const cRosterOnCse: RosterResponse | null = await facultyYApi
    .get<RosterResponse>(
      `${PATHS.roster}?courseId=${cse101.id}&sectionId=${cseSection.data?.id}`
    )
    .catch(() => null);

  // Vary the date per run so faculty-overlap checks don't collide with
  // sessions left by earlier runs of this or other backlog specs.
  const teachingSeed =
    parseInt(suffix.replace(/[^0-9a-z]/g, "").slice(-4), 36) || 17;
  const daysAgo = 40 + (teachingSeed % 320);
  async function takeSession(
    api: ApiHelper,
    courseId: string,
    sectionId: string,
    statuses: Array<{ studentId: string; status: string }>
  ): Promise<string> {
    let lastError: unknown = null;
    const candidateDates = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.now() - (daysAgo + i * 11) * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
    );
    for (const date of candidateDates) {
      for (const timingCode of TIMING_SLOTS) {
        try {
          const created = await api.post<{ status: string }>(PATHS.session, {
            courseId,
            sectionId,
            sessionDate: date,
            timingMode: "FIXED",
            timingCode,
            studentStatuses: statuses,
          });
          expect(created.status).toBe("success");
          const sessionRow = await testDb.classSession.findFirstOrThrow({
            where: {
              courseId,
              sectionId,
              sessionDate: new Date(date),
              timingCode,
            },
            select: { id: true },
          });
          return sessionRow.id;
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError ?? new Error("No free timing slot");
  }
  const facultyXApi = await createApiForRole(browser, "faculty");
  const cseSessionId = await takeSession(
    facultyXApi,
    cse101.id,
    cseSection.data?.id as string,
    [
      { studentId: studentA.studentId, status: "PRESENT" },
      { studentId: studentB.studentId, status: "PRESENT" },
    ]
  );
  const matSessionId = await takeSession(
    facultyYApi,
    mat102.id,
    matSection.data?.id as string,
    [
      { studentId: studentB.studentId, status: "PRESENT" },
      { studentId: studentC.studentId, status: "ABSENT" },
    ]
  );

  const cseRecords = await testDb.attendanceRecord.findMany({
    where: { sessionId: cseSessionId },
  });
  expect(
    cseRecords.find((r) => r.studentId === studentA.studentId)?.status
  ).toBe("PRESENT");
  expect(
    cseRecords.find((r) => r.studentId === studentB.studentId)?.status
  ).toBe("PRESENT");
  const matRecords = await testDb.attendanceRecord.findMany({
    where: { sessionId: matSessionId },
  });
  expect(
    matRecords.find((r) => r.studentId === studentB.studentId)?.status
  ).toBe("PRESENT");
  expect(
    matRecords.find((r) => r.studentId === studentC.studentId)?.status
  ).toBe("ABSENT");

  const aggACse = await testDb.attendance.findFirst({
    where: {
      studentId: studentA.studentId,
      courseId: cse101.id,
      courseRegistrationId: suppACse.id,
    },
  });
  expect(aggACse?.present).toBeGreaterThanOrEqual(1);
  const aggBCse = await testDb.attendance.findFirst({
    where: {
      studentId: studentB.studentId,
      courseId: cse101.id,
      courseRegistrationId: suppBCse.id,
    },
  });
  expect(aggBCse?.present).toBeGreaterThanOrEqual(1);
  const aggBMat = await testDb.attendance.findFirst({
    where: {
      studentId: studentB.studentId,
      courseId: mat102.id,
      courseRegistrationId: suppBMat.id,
    },
  });
  expect(aggBMat?.present).toBeGreaterThanOrEqual(1);
  const aggCMat = await testDb.attendance.findFirst({
    where: {
      studentId: studentC.studentId,
      courseId: mat102.id,
      courseRegistrationId: suppCMat.id,
    },
  });
  expect(aggCMat?.total).toBe(1);
  expect(aggCMat?.absent).toBe(1);

  const savedCse = await facultyXApi.post<{ status: string }>(PATHS.saveMarks, {
    assessmentId: cseTemplate.id,
    courseId: cse101.id,
    studentTotals: [
      { studentId: studentA.studentId, totalMarks: 14, status: "PRESENT" },
      { studentId: studentB.studentId, totalMarks: 16, status: "PRESENT" },
    ],
  });
  expect(savedCse.status).toBe("success");
  const savedMat = await facultyYApi.post<{ status: string }>(PATHS.saveMarks, {
    assessmentId: matTemplate.id,
    courseId: mat102.id,
    studentTotals: [
      { studentId: studentB.studentId, totalMarks: 9, status: "PRESENT" },
      { studentId: studentC.studentId, totalMarks: 11, status: "PRESENT" },
    ],
  });
  expect(savedMat.status).toBe("success");

  for (const [studentId, courseId, registrationId, expected, expectedCie] of [
    [studentA.studentId, cse101.id, suppACse.id, 14, 70],
    [studentB.studentId, cse101.id, suppBCse.id, 16, 80],
    [studentB.studentId, mat102.id, suppBMat.id, 9, 45],
    [studentC.studentId, mat102.id, suppCMat.id, 11, 55],
  ] as const) {
    const row = await testDb.studentAssessment.findFirst({
      where: { studentId, courseId, courseRegistrationId: registrationId },
    });
    expect(row?.totalMarks).toBe(expected);
    const markRow = await testDb.mark.findFirst({
      where: { studentId, courseId, courseRegistrationId: registrationId },
    });
    expect(markRow?.cieTotal).toBe(expectedCie);
  }

  const legacyAfter = await Promise.all([
    testDb.mark.findUniqueOrThrow({ where: { id: legacyMark.id } }),
    testDb.studentAssessment.findUniqueOrThrow({
      where: { id: legacyAssessment.id },
    }),
    testDb.attendance.findUniqueOrThrow({ where: { id: legacyAttendance.id } }),
  ]);
  expect(legacyAfter[0].cieTotal).toBe(12.5);
  expect(legacyAfter[0].status).toBe("NOT_ELIGIBLE");
  expect(legacyAfter[0].courseRegistrationId).toBe(originalCse.id);
  expect(legacyAfter[1].totalMarks).toBe(5);
  expect(legacyAfter[1].status).toBe("ABSENT");
  expect(legacyAfter[1].courseRegistrationId).toBe(originalCse.id);
  expect(legacyAfter[2].total).toBe(10);
  expect(legacyAfter[2].present).toBe(8);
  expect(legacyAfter[2].percentage).toBe(80);
  expect(legacyAfter[2].courseRegistrationId).toBe(originalCse.id);

  const s3After = await testDb.courseRegistration.findUniqueOrThrow({
    where: { id: s3Registration.id },
  });
  expect(s3After.status).toBe("ACTIVE");
  expect(s3After.registrationType).toBe("REGULAR");
  expect(cRosterOnCse).toBeNull();
});
