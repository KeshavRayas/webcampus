import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import { createAssessmentTemplate } from "../helpers/domains/assessment";
import { makeAssessment } from "../helpers/factories/assessment";

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Faculty assessment management", () => {
  test("create an assessment template with questions", async () => {
    const faculty = await testDb.faculty.findFirst({
      where: { employeeId: "CS001" },
    });
    expect(faculty).toBeDefined();

    const coordinator = await testDb.courseCoordinator.findFirst({
      where: { facultyId: faculty!.id },
      include: { course: true },
    });

    if (!coordinator) {
      test.skip(true, "No coordinator assignment found for faculty CS001");
      return;
    }

    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    const assessmentInput = makeAssessment({
      courseId: coordinator.courseId,
      semesterId: semester!.id,
    });

    const template = await createAssessmentTemplate(api, assessmentInput);
    expect(template.id).toBeDefined();
    expect(template.title).toBe(assessmentInput.title);

    const dbTemplate = await testDb.assessmentTemplate.findUnique({
      where: { id: template.id },
      include: { questions: true },
    });
    expect(dbTemplate).toBeDefined();
    expect(dbTemplate!.questions.length).toBeGreaterThanOrEqual(1);
    expect(dbTemplate!.totalMarks).toBe(assessmentInput.totalMarks);
  });
});
