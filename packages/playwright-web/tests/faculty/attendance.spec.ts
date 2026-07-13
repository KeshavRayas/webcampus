import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  createSession,
  markAttendance,
  verifyAggregationInDb,
  verifyAttendanceInDb,
} from "../helpers/domains/attendance";

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Faculty attendance management", () => {
  test("create session and mark attendance", async () => {
    const faculty = await testDb.faculty.findFirst({
      where: { employeeId: "CS001" },
    });
    expect(faculty).toBeDefined();

    const assignment = await testDb.courseAssignment.findFirst({
      where: { facultyId: faculty!.id, assignmentType: "THEORY" },
      include: { course: true, section: true },
    });
    if (!assignment) {
      test.skip(true, "No course assignment found for faculty CS001");
      return;
    }

    const session = await createSession(api, {
      courseId: assignment.courseId,
      sectionId: assignment.sectionId,
      facultyId: faculty!.id,
      sessionDate: "2026-06-15T00:00:00.000Z",
      timingCode: "FIXED_1",
      timingStartTime: "08:00",
      timingEndTime: "08:55",
    });
    expect(session.id).toBeDefined();

    const studentSections = await testDb.studentSection.findMany({
      where: { sectionId: assignment.sectionId },
      include: { student: true },
    });

    if (studentSections.length === 0) {
      test.skip(true, "No students assigned to this section");
      return;
    }

    const attendanceRecords = studentSections.map((ss, i) => ({
      studentId: ss.studentId,
      status: i % 2 === 0 ? ("PRESENT" as const) : ("ABSENT" as const),
    }));

    await markAttendance(api, session.id, attendanceRecords);

    const dbRecords = await verifyAttendanceInDb(session.id);
    expect(dbRecords.length).toBe(studentSections.length);

    const presentCount = dbRecords.filter((r) => r.status === "PRESENT").length;
    const absentCount = dbRecords.filter((r) => r.status === "ABSENT").length;
    expect(presentCount + absentCount).toBe(studentSections.length);

    for (const ss of studentSections) {
      const aggregation = await verifyAggregationInDb(
        ss.studentId,
        assignment.courseId
      );
      expect(aggregation).toBeDefined();
      expect(aggregation!.total).toBeGreaterThan(0);
    }
  });
});
