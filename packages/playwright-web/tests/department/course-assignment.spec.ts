import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  appointCoordinator,
  assignFacultyToCourse,
} from "../helpers/domains/assignment";
import { createCourse } from "../helpers/domains/course";
import { createSection } from "../helpers/domains/section";
import { makeCourse } from "../helpers/factories/course";

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Department course assignment", () => {
  test("assign faculty to a course", async () => {
    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
    });
    expect(faculty).toBeDefined();

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
    await appointCoordinator(api, {
      courseId: course.id,
      facultyId: faculty!.id,
    });

    const section = await createSection(api, {
      name: `Assignment Section-${Date.now()}`,
      departmentName: dept!.name,
      semesterId: semester!.id,
    });

    await assignFacultyToCourse(api, {
      courseId: course.id,
      semesterId: semester!.id,
      academicYear: "2026",
      sectionMappings: [
        { sectionId: section.id, theoryFacultyId: faculty!.id },
      ],
    });

    const dbAssignment = await testDb.courseAssignment.findFirst({
      where: {
        courseId: course.id,
        sectionId: section.id,
        facultyId: faculty!.id,
      },
    });
    expect(dbAssignment).toBeDefined();
    expect(dbAssignment!.courseId).toBe(course.id);
    expect(dbAssignment!.facultyId).toBe(faculty!.id);
  });
});
