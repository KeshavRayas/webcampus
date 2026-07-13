import { expect, type Page } from "@playwright/test";
import { test } from "../../fixtures/auth";
import {
  createFacultyAttendanceMockState,
  facultyAttendanceExistingSessionMock,
  facultyAttendanceExistingSessionStudentsMock,
  mockFacultyAttendanceApis,
} from "../../mocks/faculty-attendance";

const selectAttendanceSlot = async (page: Page) => {
  await page.locator("#attendance-course").click();
  await page.getByRole("option", { name: "CS301 - Algorithms" }).click();

  await page.locator("#attendance-section").click();
  await page.getByRole("option", { name: "A" }).click();

  await page
    .locator("fieldset")
    .filter({ hasText: "Time Slot" })
    .locator("[role='combobox']")
    .click();
  await page
    .getByRole("option", { name: "Regular: 08:00 AM - 08:55 AM" })
    .click();
};

const getTakeAttendanceModal = (page: Page) =>
  page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Take Attendance" }),
  });

const getEditAttendanceModal = (page: Page) =>
  page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Edit Attendance Sessions" }),
  });

test.describe("Faculty attendance", () => {
  test("opens attendance roster in modal from context card", async ({
    page,
    authenticatedAsFaculty,
  }) => {
    const state = createFacultyAttendanceMockState();
    await mockFacultyAttendanceApis(page, state);
    await authenticatedAsFaculty();

    await page.goto("/faculty/attendance");
    await selectAttendanceSlot(page);

    const takeAttendanceModal = getTakeAttendanceModal(page);
    await expect(takeAttendanceModal).toHaveCount(0);
    await page.getByRole("button", { name: "Take Attendance" }).click();

    await expect(takeAttendanceModal).toBeVisible();
    await expect(
      takeAttendanceModal.getByRole("heading", { name: "Take Attendance" })
    ).toBeVisible();
    await expect(takeAttendanceModal.getByText("Alice Johnson")).toBeVisible();
    await expect(takeAttendanceModal.getByText("Bob Rao")).toBeVisible();
    await expect(takeAttendanceModal.getByText("Course:")).toBeVisible();
    await expect(
      takeAttendanceModal.getByRole("button", { name: "Save Attendance" })
    ).toBeEnabled();
  });

  test("loads existing session from edit attendance modal", async ({
    page,
    authenticatedAsFaculty,
  }) => {
    const state = createFacultyAttendanceMockState({
      existingSession: {
        ...facultyAttendanceExistingSessionMock,
        timingCode: "09:00-09:55",
        timingLabel: "09:00 AM - 09:55 AM",
        timingStartTime: "09:00",
        timingEndTime: "09:55",
      },
      existingSessionStudents: facultyAttendanceExistingSessionStudentsMock,
    });
    await mockFacultyAttendanceApis(page, state);
    await authenticatedAsFaculty();

    await page.goto("/faculty/attendance");
    await selectAttendanceSlot(page);

    await page.getByRole("button", { name: "Edit Attendance" }).click();

    const editAttendanceModal = getEditAttendanceModal(page);
    await expect(editAttendanceModal).toBeVisible();
    await expect(
      editAttendanceModal.getByRole("heading", {
        name: "Edit Attendance Sessions",
      })
    ).toBeVisible();
    await expect(
      editAttendanceModal.getByRole("button", { name: "Edit Session" })
    ).toBeVisible();

    await editAttendanceModal
      .getByRole("button", { name: "Edit Session" })
      .click();

    const takeAttendanceModal = getTakeAttendanceModal(page);
    await expect(editAttendanceModal).toHaveCount(0);
    await expect(takeAttendanceModal).toBeVisible();
    await expect(takeAttendanceModal.getByText("Alice Johnson")).toBeVisible();
    await expect(takeAttendanceModal.getByText("Bob Rao")).toBeVisible();
    await expect(takeAttendanceModal.getByText("Present: 1")).toBeVisible();
    await expect(takeAttendanceModal.getByText("Absent: 1")).toBeVisible();
  });

  test("saves attendance only when Save Attendance is clicked", async ({
    page,
    authenticatedAsFaculty,
  }) => {
    const state = createFacultyAttendanceMockState();
    await mockFacultyAttendanceApis(page, state);
    await authenticatedAsFaculty();

    await page.goto("/faculty/attendance");
    await selectAttendanceSlot(page);
    await page.getByRole("button", { name: "Take Attendance" }).click();

    const takeAttendanceModal = getTakeAttendanceModal(page);
    await expect(takeAttendanceModal).toBeVisible();
    await expect(takeAttendanceModal.getByText("Alice Johnson")).toBeVisible();
    await expect(
      takeAttendanceModal.getByRole("button", { name: "Save Attendance" })
    ).toBeEnabled();
    expect(state.saveRequests).toHaveLength(0);

    await takeAttendanceModal
      .getByLabel("Mark Alice Johnson as absent")
      .click();
    await takeAttendanceModal
      .getByRole("button", { name: "Save Attendance" })
      .click();

    await expect.poll(() => state.saveRequests.length).toBe(1);
    expect(state.saveRequests[0]!.studentStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: "student-1",
          status: "ABSENT",
        }),
      ])
    );
  });

  test("refetches student list after saving and changing filters", async ({
    page,
    authenticatedAsFaculty,
  }) => {
    const state = createFacultyAttendanceMockState();
    await mockFacultyAttendanceApis(page, state);
    await authenticatedAsFaculty();

    await page.goto("/faculty/attendance");
    await selectAttendanceSlot(page);

    // Open Take Attendance modal
    const takeAttendanceModal = getTakeAttendanceModal(page);
    await page.getByRole("button", { name: "Take Attendance" }).click();
    await expect(takeAttendanceModal).toBeVisible();
    await expect(takeAttendanceModal.getByText("Alice Johnson")).toBeVisible();

    // Save attendance, which would previously set activeSessionId and break future fetches
    await takeAttendanceModal
      .getByRole("button", { name: "Save Attendance" })
      .click();
    await expect(takeAttendanceModal).toHaveCount(0);
    await expect.poll(() => state.saveRequests.length).toBe(1);

    // Change the date to trigger a fresh filter combination
    await page.locator("#attendance-session-date").fill("2026-04-17");

    // Click Take Attendance again -- student list must appear
    await page.getByRole("button", { name: "Take Attendance" }).click();
    await expect(takeAttendanceModal).toBeVisible();
    await expect(takeAttendanceModal.getByText("Alice Johnson")).toBeVisible();
    await expect(takeAttendanceModal.getByText("Bob Rao")).toBeVisible();
  });
});
