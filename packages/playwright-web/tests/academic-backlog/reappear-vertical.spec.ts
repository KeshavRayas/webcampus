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
  openRegistrationWindow,
} from "./fixtures";

const EXAM_ELIGIBLE = "/student/exam-registration/eligible";
const EXAM_SUBMIT = "/student/exam-registration/submit";

interface EligibilityResponse {
  status: string;
  data?: {
    isOpen: boolean;
    candidates: Array<{
      courseId: string;
      code: string;
      latestOutcome: string | null;
      eligible: boolean;
      attemptCount: number;
      nextAttemptNumber: number;
    }>;
  };
}

interface HallTicketResponse {
  status: string;
  data?: {
    courses?: Array<{ courseCode?: string; isBacklog?: boolean }>;
  };
}

test.setTimeout(300000);

async function makeBacklogStudent(
  browser: import("@playwright/test").Browser,
  suffix: string,
  tag: string,
  term: { id: string; type: "odd" | "even" | "supplementary"; year: string },
  semesterId: string,
  sectionId: string
) {
  const { makeStudent: make } = await import("./fixtures");
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await make(browser, {
        suffix: `${suffix}${tag}`,
        term,
        semesterId,
        semesterNumber: 3,
        sectionId,
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }
  }
  throw lastError ?? new Error(`makeBacklogStudent(${tag}) failed`);
}

test("reappear vertical: F/X eligible, pathway blocks, zero structural rows", async ({
  browser,
}) => {
  const suffix = `${Date.now().toString(36)}ra`;
  const adminApi = await createApiForRole(browser, "admin");

  const department = await ensureDepartment();
  const currentTerm = await ensureTerm("odd", "2026");
  const priorTerm = await ensureTerm("even", "2025");
  const priorSem1 = await ensureUgSemester(priorTerm.id, 1);
  const currentSem3 = await ensureUgSemester(currentTerm.id, 3);
  const s3Section = await ensureSection(
    department.id,
    department.name,
    currentSem3.id,
    `RA-S3-` + suffix
  );
  const s3Course = await ensureApprovedCourse({
    suffix: `${suffix}s3`,
    departmentId: department.id,
    semesterId: currentSem3.id,
    totalCredits: 4,
  });

  const newCourse = (tag: string) =>
    ensureApprovedCourse({
      suffix: tag,
      departmentId: department.id,
      semesterId: priorSem1.id,
      totalCredits: 4,
    });

  const courses = {
    f: await newCourse(`${suffix}f`),
    x: await newCourse(`${suffix}x`),
    n: await newCourse(`${suffix}n`),
    p: await newCourse(`${suffix}p`),
    q: await newCourse(`${suffix}q`),
  };
  const studentF = await makeBacklogStudent(
    browser,
    suffix,
    "sf",
    currentTerm,
    currentSem3.id,
    s3Section.id
  );
  const studentX = await makeBacklogStudent(
    browser,
    suffix,
    "sx",
    currentTerm,
    currentSem3.id,
    s3Section.id
  );
  const blocked = await makeBacklogStudent(
    browser,
    suffix,
    "sb",
    currentTerm,
    currentSem3.id,
    s3Section.id
  );

  for (const student of [studentF, studentX]) {
    await testDb.courseRegistration.create({
      data: {
        studentId: student.studentId,
        courseId: s3Course.id,
        semesterId: currentSem3.id,
        academicTermId: currentTerm.id,
      },
    });
  }

  await grantPriorAttempt({
    studentId: studentF.studentId,
    courseId: courses.f.id,
    semesterId: priorSem1.id,
    academicTermId: priorTerm.id,
    outcome: "F",
  });
  await grantPriorAttempt({
    studentId: studentX.studentId,
    courseId: courses.x.id,
    semesterId: priorSem1.id,
    academicTermId: priorTerm.id,
    outcome: "X",
  });
  await grantPriorAttempt({
    studentId: blocked.studentId,
    courseId: courses.n.id,
    semesterId: priorSem1.id,
    academicTermId: priorTerm.id,
    outcome: "NE",
  });
  await grantPriorAttempt({
    studentId: blocked.studentId,
    courseId: courses.p.id,
    semesterId: priorSem1.id,
    academicTermId: priorTerm.id,
    outcome: "P",
  });

  const pendingReg = await testDb.courseRegistration.create({
    data: {
      studentId: blocked.studentId,
      courseId: courses.q.id,
      semesterId: priorSem1.id,
      academicTermId: priorTerm.id,
    },
  });
  await testDb.examRegistration.create({
    data: {
      studentId: blocked.studentId,
      courseId: courses.q.id,
      academicTermId: priorTerm.id,
      sourceCourseRegistrationId: pendingReg.id,
      examType: "REGULAR",
      attemptNumber: 1,
      status: "REGISTERED",
      eligibleAtRegistration: false,
      outcome: "PENDING",
    },
  });

  await openRegistrationWindow(adminApi, {
    registrationType: "SUPPLEMENTARY",
    academicTermId: currentTerm.id,
    semesterId: currentSem3.id,
  });

  const baselineSections = await testDb.studentSection.count({
    where: { studentId: studentF.studentId },
  });

  const eligibility =
    await studentF.api.get<EligibilityResponse>(EXAM_ELIGIBLE);
  expect(eligibility.data?.isOpen).toBe(true);
  const fCandidate = eligibility.data?.candidates.find(
    (c) => c.courseId === courses.f.id
  );
  expect(fCandidate?.eligible).toBe(true);
  expect(fCandidate?.nextAttemptNumber).toBe(2);

  const fSubmit = await studentF.api.post(EXAM_SUBMIT, {
    courseIds: [courses.f.id],
  });
  expect((fSubmit as unknown as { status: string }).status).toBe("success");

  const xSubmit = await studentX.api.post(EXAM_SUBMIT, {
    courseIds: [courses.x.id],
  });
  expect((xSubmit as unknown as { status: string }).status).toBe("success");

  for (const [courseKey, reason] of [
    ["n", /NEEDS_FRESH_REGISTRATION|Cannot register for the reappear exam/i],
    ["p", /OUTCOME_PASSED/i],
    ["q", /ATTEMPT_IN_PROGRESS/i],
  ] as const) {
    let blockedError: unknown = null;
    try {
      await blocked.api.post(EXAM_SUBMIT, {
        courseIds: [courses[courseKey].id],
      });
    } catch (error) {
      blockedError = error;
    }
    expect(String(blockedError)).toMatch(reason);
  }

  let duplicateError: unknown = null;
  try {
    await studentF.api.post(EXAM_SUBMIT, { courseIds: [courses.f.id] });
  } catch (error) {
    duplicateError = error;
  }
  expect(String(duplicateError)).toMatch(/already exists/i);

  const fExamRow = await testDb.examRegistration.findFirstOrThrow({
    where: {
      studentId: studentF.studentId,
      courseId: courses.f.id,
      examType: "REAPPEAR",
    },
  });
  expect(fExamRow.attemptNumber).toBe(2);
  expect(fExamRow.eligibleAtRegistration).toBe(true);
  expect(fExamRow.academicTermId).toBe(currentTerm.id);
  expect(fExamRow.status).toBe("REGISTERED");
  const fSource = await testDb.courseRegistration.findUniqueOrThrow({
    where: { id: fExamRow.sourceCourseRegistrationId ?? "" },
  });
  expect(fSource.registrationType).toBe("REGULAR");
  expect(fSource.status).toBe("ACTIVE");

  const structuralCounts = {
    regs: await testDb.courseRegistration.count({
      where: { studentId: studentF.studentId, courseId: courses.f.id },
    }),
    sections: await testDb.studentSection.count({
      where: { studentId: studentF.studentId },
    }),
    attendance: await testDb.attendance.count({
      where: { studentId: studentF.studentId },
    }),
    marks: await testDb.mark.count({
      where: { studentId: studentF.studentId },
    }),
    assessments: await testDb.studentAssessment.count({
      where: { studentId: studentF.studentId },
    }),
  };
  expect(structuralCounts.regs).toBe(1);
  expect(structuralCounts.sections).toBe(baselineSections);
  expect(structuralCounts.attendance).toBe(0);
  expect(structuralCounts.marks).toBe(0);
  expect(structuralCounts.assessments).toBe(0);

  const fTicket = await adminApi.get<HallTicketResponse>(
    `/admin/hall-ticket/${studentF.studentId}/${currentTerm.id}`
  );
  expect(fTicket.status).toBe("success");
  expect(
    (fTicket.data?.courses ?? []).some(
      (paper) => paper.courseCode === courses.f.code && paper.isBacklog
    )
  ).toBe(true);

  const xTicket = await adminApi.get<HallTicketResponse>(
    `/admin/hall-ticket/${studentX.studentId}/${currentTerm.id}`
  );
  expect(
    (xTicket.data?.courses ?? []).some(
      (paper) => paper.courseCode === courses.x.code && paper.isBacklog
    )
  ).toBe(true);

  await studentF.context.close();
  await studentX.context.close();
  await blocked.context.close();
});
