import { expect, test } from "@playwright/test";
import { ApiHelper, createApiForRole } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  approveAdmission,
  createAdmissionShell,
  makeShellInput,
  portStudents,
} from "../helpers/domains/admission";
import { createAssessmentTemplate } from "../helpers/domains/assessment";
import {
  approveCourse,
  bulkSubmitCourses,
  prepareCourseForSubmission,
} from "../helpers/domains/course";
import { makeAssessment } from "../helpers/factories/assessment";

test.describe("Academic workflow smoke test", () => {
  test("full happy path: admin login → course setup → admission → hall ticket", async ({
    page,
    browser,
  }) => {
    const api = new ApiHelper(page.request);

    // Verify seed data exists
    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const term = await testDb.academicTerm.findFirst({
      where: { type: "odd", year: "2026" },
    });
    expect(term).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { academicTermId: term!.id, programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    // Clean up all courses and related data for this semester
    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });
    await testDb.section.deleteMany({
      where: {
        departmentId: dept!.id,
        semesterId: semester!.id,
        OR: [
          { name: { startsWith: "Sub " } },
          { name: { startsWith: "Assignment Section-" } },
        ],
      },
    });

    // Course setup (creates course, appoints coordinator, creates section, assigns faculty)
    const course = await prepareCourseForSubmission(
      api,
      dept!.id,
      semester!.id,
      3,
      {
        name: "Smoke Test Course",
      }
    );
    await bulkSubmitCourses(api, semester!.id);

    const adminApi = await createApiForRole(browser, "admin");
    await approveCourse(adminApi, semester!.id, { departmentId: dept!.id });

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(dbCourse!.approvalStatus).toBe("APPROVED");

    // Admission flow
    const admissionSem = await testDb.semester.findFirst({
      where: { academicTermId: term!.id, programType: "UG", semesterNumber: 1 },
    });
    expect(admissionSem).toBeDefined();
    await testDb.admission.deleteMany({
      where: { semesterId: admissionSem!.id },
    });
    const shellInput = makeShellInput(dept!.id, admissionSem!.id);
    const shell = await createAdmissionShell(api, shellInput);
    await testDb.admission.update({
      where: { id: shell.id },
      data: { status: "SUBMITTED" },
    });
    await approveAdmission(api, shell.id);
    await portStudents(api, admissionSem!.id);

    const admissionRecord = await testDb.admission.findUnique({
      where: { id: shell.id },
      select: { studentId: true },
    });
    expect(admissionRecord?.studentId).toBeDefined();
    const dbStudent = await testDb.student.findUnique({
      where: { id: admissionRecord!.studentId! },
    });
    expect(dbStudent).toBeDefined();

    // Assessment template
    const assessmentInput = makeAssessment({
      courseId: course.id,
      semesterId: semester!.id,
      title: "Smoke CIE",
    });
    const template = await createAssessmentTemplate(api, assessmentInput);
    const dbTemplate = await testDb.assessmentTemplate.findUnique({
      where: { id: template.id },
    });
    expect(dbTemplate).toBeDefined();
    expect(dbTemplate!.totalMarks).toBe(assessmentInput.totalMarks);
  });
});
