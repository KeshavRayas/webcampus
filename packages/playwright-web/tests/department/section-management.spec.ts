import { expect, test } from "@playwright/test";
import { ApiHelper, createApiForRole } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import { createAndPortStudent } from "../helpers/domains/admission";
import {
  assignStudentToSection,
  createSection,
  getSectionAssignments,
  verifyStudentSectionsInDb,
} from "../helpers/domains/section";

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Department section management", () => {
  test("create a section", async () => {
    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    const section = await createSection(api, {
      name: `Test Section A-${Date.now()}`,
      departmentName: dept!.name,
      semesterId: semester!.id,
    });
    expect(section.id).toBeDefined();

    const dbSection = await testDb.section.findUnique({
      where: { id: section.id },
    });
    expect(dbSection).toBeDefined();
    expect(dbSection!.name).toBe(section.name);
  });

  test("assign multiple students to a section", async ({ browser }) => {
    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    const section = await createSection(api, {
      name: `Multi Student Section-${Date.now()}`,
      departmentName: dept!.name,
      semesterId: semester!.id,
    });

    const adminApi = await createApiForRole(browser, "admin");

    const student1 = await createAndPortStudent(adminApi, dept!, semester!);
    const student2 = await createAndPortStudent(adminApi, dept!, semester!);

    const assign1 = await assignStudentToSection(api, {
      studentId: student1.studentId,
      sectionId: section.id,
      semester: 3,
      academicYear: "2025-2026",
    });
    expect(assign1.id).toBeDefined();

    const assign2 = await assignStudentToSection(api, {
      studentId: student2.studentId,
      sectionId: section.id,
      semester: 3,
      academicYear: "2025-2026",
    });
    expect(assign2.id).toBeDefined();

    const apiAssignments = await getSectionAssignments(api, section.id);
    const studentIds = apiAssignments.map((a) => a.studentId);
    expect(studentIds).toContain(student1.studentId);
    expect(studentIds).toContain(student2.studentId);

    const dbAssignments = await verifyStudentSectionsInDb(section.id);
    expect(dbAssignments.length).toBe(2);
    const dbStudentIds = dbAssignments.map((a) => a.studentId);
    expect(dbStudentIds).toContain(student1.studentId);
    expect(dbStudentIds).toContain(student2.studentId);
  });

  test("reject duplicate student assignment to same section", async ({
    browser,
  }) => {
    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    const section = await createSection(api, {
      name: `Duplicate Test Section-${Date.now()}`,
      departmentName: dept!.name,
      semesterId: semester!.id,
    });

    const adminApi = await createApiForRole(browser, "admin");
    const student = await createAndPortStudent(adminApi, dept!, semester!);

    const assign = await assignStudentToSection(api, {
      studentId: student.studentId,
      sectionId: section.id,
      semester: 3,
      academicYear: "2025-2026",
    });
    expect(assign.id).toBeDefined();

    await expect(
      assignStudentToSection(api, {
        studentId: student.studentId,
        sectionId: section.id,
        semester: 3,
        academicYear: "2025-2026",
      })
    ).rejects.toThrow();
  });
});
