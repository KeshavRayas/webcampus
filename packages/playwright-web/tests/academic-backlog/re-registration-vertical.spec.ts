import { expect, test } from "@playwright/test";
import { createApiForRole, type ApiHelper } from "../helpers/api/client";
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
  reRegistrationEligible: "/student/re-registration/eligible",
  reRegistrationSubmit: "/student/re-registration/submit",
  rrOffering: "/admin/re-registration-offering",
  courseAssignmentUpsert: "/admin/course-assignment/upsert",
  sessionStudents: "/faculty/attendance/session/students",
  attendanceSessions: "/faculty/attendance/session",
  saveMarks: "/faculty/marks/assessments/save-marks",
};

const FACULTY_EMAIL = "faculty.cs@webcampus.com";

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

interface RosterResponse {
  status: string;
  data?: {
    students: Array<{ studentId: string; usn: string; name: string }>;
  };
}

async function countInRoster(
  api: ApiHelper,
  courseId: string,
  sectionId: string,
  studentId: string
): Promise<number> {
  const roster = await api.get<RosterResponse>(
    `${PATHS.sessionStudents}?courseId=${courseId}&sectionId=${sectionId}`
  );
  expect(roster.status).toBe("success");
  return (
    roster.data?.students.filter((student) => student.studentId === studentId)
      .length ?? 0
  );
}

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

test.setTimeout(300000);

test("S3 student re-registers an S1 NE course and receives new attendance plus CIE without touching history", async ({
  browser,
}) => {
  const suffix = uniqueSuffix("rrv");
  const department = await ensureDepartment();
  const currentTerm = await ensureTerm("odd", "2026");
  const priorTerm = await ensureTerm("even", "2025");
  const priorSem1 = await ensureUgSemester(priorTerm.id, 1);
  const currentSem1 = await ensureUgSemester(currentTerm.id, 1);
  const currentSem3 = await ensureUgSemester(currentTerm.id, 3);

  const s3Section = await ensureSection(
    department.id,
    department.name,
    currentSem3.id,
    `RRV-S3-${suffix}`
  );
  const backlogCourse = await ensureApprovedCourse({
    suffix,
    departmentId: department.id,
    semesterId: priorSem1.id,
  });
  const s3Course = await ensureApprovedCourse({
    suffix: `${suffix}c`,
    departmentId: department.id,
    semesterId: currentSem3.id,
  });

  const student: StudentFixture = await makeStudent(browser, {
    suffix,
    term: currentTerm,
    semesterId: currentSem3.id,
    semesterNumber: 3,
    sectionId: s3Section.id,
  });

  const s3Registration = await testDb.courseRegistration.create({
    data: {
      studentId: student.studentId,
      courseId: s3Course.id,
      semesterId: currentSem3.id,
      academicTermId: currentTerm.id,
    },
  });

  const original = await grantPriorAttempt({
    studentId: student.studentId,
    courseId: backlogCourse.id,
    semesterId: priorSem1.id,
    academicTermId: priorTerm.id,
    outcome: "NE",
  });

  const template = await testDb.assessmentTemplate.create({
    data: {
      courseId: backlogCourse.id,
      semesterId: backlogCourse.semesterId,
      title: `CIE1-${suffix}`,
      totalMarks: 20,
      componentType: "THEORY",
      sequence: 1,
    },
  });

  const legacyMark = await testDb.mark.create({
    data: {
      studentId: student.studentId,
      courseId: backlogCourse.id,
      cieTotal: 12.5,
      status: "NOT_ELIGIBLE",
      courseRegistrationId: original.id,
    },
  });
  const legacyAssessment = await testDb.studentAssessment.create({
    data: {
      studentId: student.studentId,
      assessmentId: template.id,
      courseId: backlogCourse.id,
      totalMarks: 5,
      status: "ABSENT",
      courseRegistrationId: original.id,
    },
  });
  const legacyAttendance = await testDb.attendance.create({
    data: {
      studentId: student.studentId,
      courseId: backlogCourse.id,
      total: 10,
      present: 8,
      absent: 2,
      percentage: 80,
      courseRegistrationId: original.id,
    },
  });

  const adminApi = await createApiForRole(browser, "admin");
  await openRegistrationWindow(adminApi, {
    registrationType: "RE_REGISTRATION",
    academicTermId: currentTerm.id,
    semesterId: currentSem3.id,
    departmentId: department.id,
  });

  const eligible = await student.api.get<EligibilityResponse>(
    PATHS.reRegistrationEligible
  );
  expect(eligible.status).toBe("success");
  expect(eligible.data?.isOpen).toBe(true);
  const candidate = eligible.data?.candidates.find(
    (item) => item.courseId === backlogCourse.id
  );
  expect(candidate?.eligible).toBe(true);

  const submitted = await student.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.reRegistrationSubmit, { courseIds: [backlogCourse.id] });
  expect(submitted.status).toBe("success");
  expect(submitted.data?.count).toBe(1);

  const attemptRows = await testDb.courseRegistration.findMany({
    where: { studentId: student.studentId, courseId: backlogCourse.id },
  });
  expect(attemptRows).toHaveLength(2);
  const supersededRow = attemptRows.find((row) => row.id === original.id);
  const activeRow = attemptRows.find((row) => row.id !== original.id);
  expect(supersededRow?.status).toBe("SUPERSEDED");
  expect(supersededRow?.registrationType).toBe("REGULAR");
  expect(activeRow?.status).toBe("ACTIVE");
  expect(activeRow?.registrationType).toBe("RE_REGISTRATION");
  expect(activeRow?.sourceRegistrationId).toBe(original.id);
  expect(activeRow?.semesterId).toBe(priorSem1.id);
  expect(activeRow?.academicTermId).toBe(currentTerm.id);

  const s3AfterSubmit = await testDb.courseRegistration.findUniqueOrThrow({
    where: { id: s3Registration.id },
  });
  expect(s3AfterSubmit.status).toBe("ACTIVE");
  expect(s3AfterSubmit.registrationType).toBe("REGULAR");

  const legacyMarkAfterSubmit = await testDb.mark.findUniqueOrThrow({
    where: { id: legacyMark.id },
  });
  expect(legacyMarkAfterSubmit.cieTotal).toBe(12.5);
  expect(legacyMarkAfterSubmit.courseRegistrationId).toBe(original.id);

  const offering = await adminApi.post<{
    status: string;
    data?: { id: string; semesterId: string; semesterNumber: number };
  }>(PATHS.rrOffering, {
    academicTermId: currentTerm.id,
    courseId: backlogCourse.id,
    name: `RR-BLG-${suffix}`,
  });
  expect(offering.status).toBe("success");
  const rrSectionId = offering.data?.id;
  expect(rrSectionId).toBeDefined();
  expect(offering.data?.semesterId).toBe(currentSem1.id);
  expect(offering.data?.semesterNumber).toBe(1);

  const facultyProfile = await testDb.faculty.findFirst({
    where: { user: { email: FACULTY_EMAIL } },
  });
  expect(facultyProfile).toBeDefined();

  for (const mapping of [
    {
      courseId: backlogCourse.id,
      semesterId: currentSem1.id,
      sectionId: rrSectionId as string,
    },
    {
      courseId: s3Course.id,
      semesterId: currentSem3.id,
      sectionId: s3Section.id,
    },
  ]) {
    await adminApi.put(PATHS.courseAssignmentUpsert, {
      courseId: mapping.courseId,
      semesterId: mapping.semesterId,
      academicYear: "2025-26",
      sectionMappings: [
        {
          sectionId: mapping.sectionId,
          theoryFacultyId: facultyProfile?.id,
        },
      ],
      isSuperEdit: true,
      departmentId: department.id,
      departmentName: department.name,
      reason: "Re-registration offering faculty mapping",
    });
  }

  const assigned = await adminApi.post<{
    status: string;
    data?: { placedCount: number };
  }>(`${PATHS.rrOffering}/${rrSectionId}/students`, {
    studentIds: [student.studentId],
  });
  expect(assigned.status).toBe("success");
  expect(assigned.data?.placedCount).toBe(1);

  const facultyApi = await createApiForRole(browser, "faculty");
  expect(
    await countInRoster(
      facultyApi,
      backlogCourse.id,
      rrSectionId as string,
      student.studentId
    )
  ).toBe(1);
  expect(
    await countInRoster(
      facultyApi,
      s3Course.id,
      s3Section.id,
      student.studentId
    )
  ).toBe(1);

  let sessionError: unknown;
  const verticalSeed =
    parseInt(suffix.replace(/[^0-9a-z]/g, "").slice(-4), 36) || 13;
  const verticalDaysAgo = 40 + (verticalSeed % 320);
  const verticalDates = Array.from({ length: 30 }, (_, i) =>
    new Date(
      Date.now() - (verticalDaysAgo + i * 11) * 24 * 60 * 60 * 1000
    ).toISOString()
  );
  outer: for (const sessionDate of verticalDates) {
    for (const slot of TIMING_SLOTS) {
      try {
        await facultyApi.post(PATHS.attendanceSessions, {
          courseId: backlogCourse.id,
          sectionId: rrSectionId,
          sessionDate,
          timingMode: "FIXED",
          timingCode: slot,
          studentStatuses: [
            { studentId: student.studentId, status: "PRESENT" },
          ],
        });
        sessionError = null;
        break outer;
      } catch (error) {
        sessionError = error;
      }
    }
  }
  if (sessionError) throw sessionError;

  const rrSessions = await testDb.classSession.findMany({
    where: { courseId: backlogCourse.id, sectionId: rrSectionId },
    select: { id: true },
  });
  expect(rrSessions.length).toBeGreaterThanOrEqual(1);
  const rrSessionRecords = await testDb.attendanceRecord.findMany({
    where: {
      studentId: student.studentId,
      sessionId: { in: rrSessions.map((session) => session.id) },
    },
  });
  expect(rrSessionRecords.length).toBeGreaterThanOrEqual(1);

  const newAggregate = await testDb.attendance.findFirst({
    where: {
      studentId: student.studentId,
      courseId: backlogCourse.id,
      id: { not: legacyAttendance.id },
    },
  });
  expect(newAggregate).toBeDefined();
  expect(newAggregate?.courseRegistrationId).toBe(activeRow?.id);
  expect(newAggregate?.present).toBeGreaterThanOrEqual(1);

  const savedMarks = await facultyApi.post<{ status: string }>(
    PATHS.saveMarks,
    {
      assessmentId: template.id,
      courseId: backlogCourse.id,
      studentTotals: [
        { studentId: student.studentId, totalMarks: 14, status: "PRESENT" },
      ],
    }
  );
  expect(savedMarks.status).toBe("success");

  const assessments = await testDb.studentAssessment.findMany({
    where: { studentId: student.studentId, assessmentId: template.id },
  });
  expect(assessments).toHaveLength(2);
  const newAssessment = assessments.find(
    (row) => row.courseRegistrationId === activeRow?.id
  );
  const oldAssessmentAfter = assessments.find(
    (row) => row.id === legacyAssessment.id
  );
  expect(newAssessment?.totalMarks).toBe(14);
  expect(oldAssessmentAfter?.totalMarks).toBe(5);
  expect(oldAssessmentAfter?.courseRegistrationId).toBe(original.id);

  const marks = await testDb.mark.findMany({
    where: { studentId: student.studentId, courseId: backlogCourse.id },
  });
  expect(marks).toHaveLength(2);
  const newMark = marks.find(
    (row) => row.courseRegistrationId === activeRow?.id
  );
  const oldMarkAfter = marks.find((row) => row.id === legacyMark.id);
  expect(newMark).toBeDefined();
  expect(oldMarkAfter?.cieTotal).toBe(12.5);
  expect(oldMarkAfter?.courseRegistrationId).toBe(original.id);

  const legacyAttendanceAfter = await testDb.attendance.findUniqueOrThrow({
    where: { id: legacyAttendance.id },
  });
  expect(legacyAttendanceAfter.total).toBe(10);
  expect(legacyAttendanceAfter.present).toBe(8);
  expect(legacyAttendanceAfter.percentage).toBe(80);
  expect(legacyAttendanceAfter.courseRegistrationId).toBe(original.id);
});

test("promoted NE carrier re-registers exactly once into the roster", async ({
  browser,
}) => {
  test.setTimeout(300000);
  const suffix = uniqueSuffix("rrp");
  const department = await ensureDepartment();
  const currentTerm = await ensureTerm("odd", "2026");
  const priorTerm = await ensureTerm("even", "2025");
  const priorSem2 = await ensureUgSemester(priorTerm.id, 2);
  const currentSem3 = await ensureUgSemester(currentTerm.id, 3);
  const section = await ensureSection(
    department.id,
    department.name,
    priorSem2.id,
    `RRP-S2-${suffix}`
  );
  const course = await ensureApprovedCourse({
    suffix,
    departmentId: department.id,
    semesterId: priorSem2.id,
  });
  const student: StudentFixture = await makeStudent(browser, {
    suffix,
    term: priorTerm,
    semesterId: priorSem2.id,
    semesterNumber: 2,
    sectionId: section.id,
  });
  const original = await grantPriorAttempt({
    studentId: student.studentId,
    courseId: course.id,
    semesterId: priorSem2.id,
    academicTermId: priorTerm.id,
    outcome: "NE",
  });

  const adminApi = await createApiForRole(browser, "admin");
  const promoted = await adminApi.post<{ status: string }>("/admin/promotion", {
    fromSemesterId: priorSem2.id,
    toSemesterId: currentSem3.id,
    studentIds: [student.studentId],
  });
  expect(promoted.status).toBe("success");

  await openRegistrationWindow(adminApi, {
    registrationType: "RE_REGISTRATION",
    academicTermId: currentTerm.id,
    semesterId: currentSem3.id,
    departmentId: department.id,
  });
  const eligible = await student.api.get<EligibilityResponse>(
    PATHS.reRegistrationEligible
  );
  expect(eligible.status).toBe("success");
  const candidate = eligible.data?.candidates.find(
    (item) => item.courseId === course.id
  );
  expect(candidate?.eligible).toBe(true);
  const submitted = await student.api.post<{
    status: string;
    data?: { count: number };
  }>(PATHS.reRegistrationSubmit, { courseIds: [course.id] });
  expect(submitted.data?.count).toBe(1);

  const registrations = await testDb.courseRegistration.findMany({
    where: { studentId: student.studentId, courseId: course.id },
    orderBy: { registrationDate: "asc" },
  });
  expect(registrations).toHaveLength(2);
  const originalRow = registrations.find(
    (item) => item.registrationType === "REGULAR"
  );
  const redo = registrations.find(
    (item) => item.registrationType === "RE_REGISTRATION"
  );
  expect(originalRow?.id).toBe(original.id);
  expect(originalRow?.status).toBe("SUPERSEDED");
  expect(redo?.status).toBe("ACTIVE");
  expect(redo?.sourceRegistrationId).toBe(original.id);
  expect(redo?.semesterId).toBe(priorSem2.id);
  expect(redo?.academicTermId).toBe(currentTerm.id);

  const roster = await testDb.courseRegistration.findMany({
    where: {
      courseId: course.id,
      semesterId: priorSem2.id,
      academicTermId: currentTerm.id,
      status: "ACTIVE",
      registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
    },
  });
  expect(roster).toHaveLength(1);
  expect(roster[0]?.registrationType).toBe("RE_REGISTRATION");

  await student.context.close();
});
