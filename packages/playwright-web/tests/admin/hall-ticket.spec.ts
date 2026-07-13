import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  previewHallTicket,
  sendHallTickets,
} from "../helpers/domains/hall-ticket";

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Admin hall ticket management", () => {
  test("list eligible students for hall ticket", async () => {
    const term = await testDb.academicTerm.findFirst({
      where: { type: "odd", year: "2026" },
    });
    expect(term).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { academicTermId: term!.id, programType: "UG", semesterNumber: 1 },
    });
    expect(semester).toBeDefined();

    const students = await testDb.student.findMany({
      where: { academicTermId: term!.id },
      take: 5,
    });

    if (students.length === 0) {
      test.skip(true, "No students available for hall ticket test");
      return;
    }

    const firstStudent = students[0]!;
    const preview = await previewHallTicket(api, firstStudent.id, term!.id);
    expect(preview.studentId).toBe(firstStudent.id);
    expect(preview.usn).toBe(firstStudent.usn);
  });

  test("send hall tickets and verify db", async () => {
    const term = await testDb.academicTerm.findFirst({
      where: { type: "odd", year: "2026" },
    });
    expect(term).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { academicTermId: term!.id, programType: "UG", semesterNumber: 1 },
    });
    expect(semester).toBeDefined();

    const students = await testDb.student.findMany({
      where: { academicTermId: term!.id },
      take: 3,
    });

    if (students.length === 0) {
      test.skip(true, "No students available for hall ticket send test");
      return;
    }

    const firstStudent = students[0]!;
    const count = await sendHallTickets(
      api,
      students.map((s) => s.id),
      term!.id,
      semester!.id
    );
    expect(count).toBeGreaterThan(0);

    const dbTicket = await testDb.hallTicket.findFirst({
      where: { studentId: firstStudent.id, academicTermId: term!.id },
    });
    expect(dbTicket).toBeDefined();
    expect(dbTicket!.isSent).toBe(true);
  });
});
