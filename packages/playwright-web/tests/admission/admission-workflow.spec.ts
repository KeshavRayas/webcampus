import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  approveAdmission,
  createAdmissionShell,
  makeShellInput,
  portStudents,
} from "../helpers/domains/admission";

test.describe("Admission workflow", () => {
  test("full admission lifecycle: shell → port → verify", async ({ page }) => {
    const api = new ApiHelper(page.request);

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();

    const term = await testDb.academicTerm.findFirst({
      where: { type: "odd", year: "2026" },
    });
    expect(term).toBeDefined();

    const semester = await testDb.semester.findFirst({
      where: { academicTermId: term!.id, programType: "UG", semesterNumber: 1 },
    });
    expect(semester).toBeDefined();

    // Clean up any leftover test data for this semester
    await testDb.admission.deleteMany({
      where: { semesterId: semester!.id },
    });

    const shellInput = makeShellInput(dept!.id, semester!.id);
    const shell = await createAdmissionShell(api, shellInput);
    expect(shell.id).toBeDefined();
    expect(shell.applicationId).toBe(shellInput.applicationId);
    expect(shell.tempUsn).toBeDefined();

    // Skip applicant submit (S3 uploads); advance status directly in DB
    await testDb.admission.update({
      where: { id: shell.id },
      data: { status: "SUBMITTED" },
    });

    await approveAdmission(api, shell.id);
    const approvedDb = await testDb.admission.findUnique({
      where: { id: shell.id },
    });
    expect(approvedDb!.status).toBe("APPROVED");

    await portStudents(api, semester!.id);

    const admissionRecord = await testDb.admission.findUnique({
      where: { id: shell.id },
      select: { studentId: true },
    });
    expect(admissionRecord?.studentId).toBeDefined();
    const student = await testDb.student.findUnique({
      where: { id: admissionRecord!.studentId! },
      include: { user: true },
    });
    expect(student).toBeDefined();
    expect(student!.departmentName).toBe("Computer Science and Engineering");
  });
});
