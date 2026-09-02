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

  test("GET /admin/department returns seeded departments (not stale cache)", async ({
    page,
  }) => {
    const res = await page.request.get(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/admin/department`
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const departments = body?.data ?? [];
    const codes = departments.map((d: { code?: string }) => d.code) as string[];
    expect(codes).toContain("CS");
    expect(codes).toContain("FY");
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
    const admissionUser = await testDb.user.findFirst({
      where: { email: "admission@webcampus.com" },
    });
    const admissionInstructor = await testDb.user.findFirst({
      where: { email: "admission-instructor@webcampus.com" },
    });
    expect(admissionUser).toBeDefined();
    expect(admissionInstructor).toBeDefined();
    expect(admissionUser!.role).toBe("admission");
    expect(admissionInstructor!.role).toBe("admission-instructor");
  });
});
