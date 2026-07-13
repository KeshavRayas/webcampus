import { expect, test } from "@playwright/test";
import { ApiHelper, createApiForRole } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  approveCourse,
  bulkSubmitCourses,
  createCourse,
  prepareCourseForSubmission,
} from "../helpers/domains/course";
import { makeCourse } from "../helpers/factories/course";

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Department course configuration", () => {
  test("create a course as draft", async () => {
    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    // Clean up any PENDING/APPROVED courses from previous runs
    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const courseInput = makeCourse({
      departmentId: dept!.id,
      semesterId: semester!.id,
      semesterNumber: 3,
    });
    const course = await createCourse(api, courseInput);
    expect(course.id).toBeDefined();

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(dbCourse).toBeDefined();
    expect(dbCourse!.approvalStatus).toBe("DRAFT");
  });

  test("create, submit and approve a course", async ({ browser }) => {
    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
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
    const course = await prepareCourseForSubmission(
      api,
      dept!.id,
      semester!.id,
      3
    );
    await bulkSubmitCourses(api, semester!.id);

    let dbCourse = await testDb.course.findUnique({ where: { id: course.id } });
    expect(dbCourse!.approvalStatus).toBe("PENDING");

    const adminApi = await createApiForRole(browser, "admin");
    await approveCourse(adminApi, semester!.id, { departmentId: dept!.id });
    dbCourse = await testDb.course.findUnique({ where: { id: course.id } });
    expect(dbCourse!.approvalStatus).toBe("APPROVED");
  });

  test("fail approval for invalid semester", async ({ browser }) => {
    const adminApi = await createApiForRole(browser, "admin");
    await expect(
      approveCourse(adminApi, "00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow();
  });
});
