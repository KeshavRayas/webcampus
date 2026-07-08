import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import { createAssessmentTemplate } from "../helpers/domains/assessment";
import { makeAssessment } from "../helpers/factories/assessment";

const PATHS = {
  dashboard: "/faculty/marks/assessments/dashboard",
  saveMarks: "/faculty/marks/assessments/save-marks",
  marksDetail: (id: string) => `/faculty/marks/assessments/${id}/marks`,
};

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Faculty marks entry", () => {
  test("enter marks for an assessment and verify CIE total", async () => {
    const faculty = await testDb.faculty.findFirst({
      where: { employeeId: "CS001" },
    });
    expect(faculty).toBeDefined();

    const coordinator = await testDb.courseCoordinator.findFirst({
      where: { facultyId: faculty!.id },
      include: { course: true },
    });
    if (!coordinator) {
      test.skip(true, "No coordinator assignment found");
      return;
    }

    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    const assessmentInput = makeAssessment({
      courseId: coordinator.courseId,
      semesterId: semester!.id,
      title: "CIE Marks Test",
    });

    const template = await createAssessmentTemplate(api, assessmentInput);

    const dbQuestions = await testDb.assessmentQuestion.findMany({
      where: { assessmentId: template.id },
    });
    expect(dbQuestions.length).toBeGreaterThan(0);

    const registeredStudents = await testDb.courseRegistration.findMany({
      where: { courseId: coordinator.courseId },
      include: { student: true },
    });
    if (registeredStudents.length === 0) {
      test.skip(true, "No registered students for this course");
      return;
    }

    const firstReg = registeredStudents[0]!;
    const marksPayload = registeredStudents.map((rs) => ({
      studentId: rs.studentId,
      courseId: coordinator.courseId,
      assessmentId: template.id,
      questionMarks: dbQuestions.map((q) => ({
        questionId: q.id,
        marksObtained: Math.floor(q.marks * 0.7),
      })),
      totalMarks: Math.floor(assessmentInput.totalMarks * 0.7),
    }));

    for (const payload of marksPayload) {
      await api.post(PATHS.saveMarks, payload);
    }

    const studentMark = await testDb.studentAssessment.findFirst({
      where: {
        studentId: firstReg.studentId,
        assessmentId: template.id,
      },
    });
    expect(studentMark).toBeDefined();
    expect(studentMark!.totalMarks).toBeGreaterThan(0);

    const mark = await testDb.mark.findFirst({
      where: {
        studentId: firstReg.studentId,
        courseId: coordinator.courseId,
      },
    });

    if (mark) {
      expect(mark.cieTotal).toBeGreaterThanOrEqual(0);
      expect(mark.status).toMatch(/ELIGIBLE|NOT_ELIGIBLE/);
    }
  });
});
