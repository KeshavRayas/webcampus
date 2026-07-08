import { expect, test } from "@playwright/test";
import { ApiHelper } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  adminFreezeToggle,
  facultyFreezeToggle,
  hodFreezeToggle,
  verifyFreezeInDb,
} from "../helpers/domains/freeze";

let api: ApiHelper;

test.beforeEach(async ({ page }) => {
  api = new ApiHelper(page.request);
});

test.describe("Freeze lifecycle management", () => {
  test("full freeze chain: faculty → hod → admin", async () => {
    const assignment = await testDb.courseAssignment.findFirst({
      where: {
        assignmentType: "THEORY",
      },
    });
    if (!assignment) {
      test.skip(true, "No course assignment available for freeze test");
      return;
    }

    const freeze = await testDb.freeze.findUnique({
      where: { courseAssignmentId: assignment.id },
    });
    if (freeze) {
      await adminFreezeToggle(api, assignment.id, false);
    }

    await facultyFreezeToggle(api, assignment.id, true);
    let dbFreeze = await verifyFreezeInDb(assignment.id);
    expect(dbFreeze).toBeDefined();
    expect(dbFreeze!.facultyFrozen).toBe(true);

    await hodFreezeToggle(api, assignment.id, true);
    dbFreeze = await verifyFreezeInDb(assignment.id);
    expect(dbFreeze!.hodFrozen).toBe(true);

    await adminFreezeToggle(api, assignment.id, true);
    dbFreeze = await verifyFreezeInDb(assignment.id);
    expect(dbFreeze!.adminFrozen).toBe(true);

    await adminFreezeToggle(api, assignment.id, false);
    dbFreeze = await verifyFreezeInDb(assignment.id);
    expect(dbFreeze!.adminFrozen).toBe(false);
  });
});
