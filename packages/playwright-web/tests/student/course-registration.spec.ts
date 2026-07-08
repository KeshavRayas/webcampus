import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  createRegistrationWindow,
  submitCourseRegistration,
  toggleRegistrationWindow,
  verifyRegistrationInDb,
} from "../helpers/domains/registration";

test.describe("Student course registration", () => {
  test("open registration window and register for courses", async ({
    page,
  }) => {
    const api = new ApiHelper(page.request);

    const student = await testDb.student.findFirst({
      include: { studentSections: true },
    });
    if (!student || student.studentSections.length === 0) {
      test.skip(true, "No student with section assignments available");
      return;
    }

    if (!student.programType) {
      test.skip(true, "Student has no program type");
      return;
    }

    const term = await testDb.academicTerm.findFirst({
      where: { type: "odd", year: "2026" },
    });
    expect(term).toBeDefined();

    const semester = await testDb.semester.findFirst({
      where: {
        academicTermId: term!.id,
        programType: student.programType,
        semesterNumber: student.currentSemester,
      },
    });
    expect(semester).toBeDefined();

    const window = await createRegistrationWindow(api, {
      academicTermId: term!.id,
      semesterId: semester!.id,
      departmentId: "",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-12-31T00:00:00.000Z",
    });
    await toggleRegistrationWindow(api, window.id, true);

    const courses = await testDb.course.findMany({
      where: {
        approvalStatus: "APPROVED",
      },
      take: 2,
    });

    if (courses.length === 0) {
      test.skip(true, "No approved courses available for registration");
      return;
    }

    const registrations = await submitCourseRegistration(
      api,
      courses.map((c) => c.id)
    );
    expect(registrations.courseRegistrations.length).toBeGreaterThan(0);

    for (const reg of registrations.courseRegistrations) {
      const dbReg = await verifyRegistrationInDb(student.id, reg.courseId);
      expect(dbReg).toBeDefined();
    }
  });
});
