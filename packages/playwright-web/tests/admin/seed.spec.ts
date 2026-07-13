import { expect, test } from "@playwright/test";
import { testDb } from "../helpers/api/db";

test.describe("Seed data verification", () => {
  test("mock_start seeded departments", async () => {
    const departments = await testDb.department.findMany({
      where: { code: { in: ["CS", "FY", "CE"] } },
    });
    expect(departments.length).toBeGreaterThanOrEqual(3);
    const cs = departments.find((d) => d.code === "CS");
    expect(cs).toBeDefined();
    expect(cs!.name).toBe("Computer Science and Engineering");
  });

  test("mock_start seeded faculty", async () => {
    const faculties = await testDb.faculty.findMany({
      where: { employeeId: { in: ["CS001", "FY001", "CE001"] } },
    });
    expect(faculties.length).toBeGreaterThanOrEqual(3);
    const csFaculty = faculties.find((f) => f.employeeId === "CS001");
    expect(csFaculty).toBeDefined();
  });

  test("mock_start seeded academic term and semesters", async () => {
    const term = await testDb.academicTerm.findFirst({
      where: { type: "odd", year: "2026" },
      include: { Semester: true },
    });
    expect(term).toBeDefined();
    expect(term!.Semester.length).toBeGreaterThanOrEqual(1);
    const ugOdd = term!.Semester.filter(
      (s) => s.programType === "UG" && s.semesterNumber % 2 === 1
    );
    expect(ugOdd.length).toBe(4);
  });

  test("mock_start seeded admission users", async () => {
    const admissionAdmin = await testDb.user.findFirst({
      where: { email: "admission.admin@webcampus.com" },
    });
    const admissionReviewer = await testDb.user.findFirst({
      where: { email: "admission.reviewer@webcampus.com" },
    });
    expect(admissionAdmin).toBeDefined();
    expect(admissionReviewer).toBeDefined();
    expect(admissionAdmin!.role).toBe("admission_admin");
    expect(admissionReviewer!.role).toBe("admission_reviewer");
  });
});
