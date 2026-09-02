import { expect, type Page, type Route } from "@playwright/test";
import { test } from "../../fixtures/auth";
import {
  facultyHandlingAssignmentsMock,
  facultyHandlingLabAssignmentsMock,
  facultyHandlingStudentsMock,
} from "../../mocks/faculty-handling";

const mockHandlingApis = async ({ page }: { page: Page }) => {
  await page.route("**/admin/semester**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: [],
      }),
    });
  });

  await page.route("**/faculty/handling/courses*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(facultyHandlingAssignmentsMock),
    });
  });

  await page.route("**/faculty/handling/lab*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(facultyHandlingLabAssignmentsMock),
    });
  });

  await page.route("**/faculty/handling/*/students*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(facultyHandlingStudentsMock),
    });
  });
};

test.describe("Faculty handling", () => {
  test.beforeEach(async ({ page, authenticatedAsFaculty }) => {
    await mockHandlingApis({ page });
    await authenticatedAsFaculty();
  });

  test("shows sidebar active state on handling courses", async ({ page }) => {
    await page.goto("/faculty/handling/courses");

    const handlingParent = page
      .locator('[data-sidebar="menu-button"][data-active="true"]')
      .filter({ hasText: "Handling" });
    await expect(handlingParent).toBeVisible();

    const activeChild = page
      .locator('[data-sidebar="menu-sub-button"][data-active="true"]')
      .filter({ hasText: "Courses" });
    await expect(activeChild).toBeVisible();
  });

  test("navigates Handling to Courses", async ({ page }) => {
    await page.goto("/faculty");

    await page.getByRole("link", { name: "Courses" }).click();
    await page.waitForURL("**/faculty/handling/courses");

    await expect(
      page.getByRole("heading", { name: "Handling Courses" })
    ).toBeVisible();
  });

  test("navigates Handling to Lab", async ({ page }) => {
    await page.goto("/faculty/handling/courses");

    await page.getByRole("link", { name: "Lab" }).click();
    await page.waitForURL("**/faculty/handling/lab");

    await expect(
      page.getByRole("heading", { name: "Handling Lab" })
    ).toBeVisible();
  });

  test("persists filters in query params", async ({ page }) => {
    await page.goto("/faculty/handling/courses");

    await page.locator("#courses-handling-search").fill("algo");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/search=algo/);

    await page.reload();

    await expect(page.locator("#courses-handling-search")).toHaveValue("algo");
  });

  test("opens students drill-down from assignment row", async ({ page }) => {
    await page.goto("/faculty/handling/courses");

    await page.getByRole("cell", { name: "CS301" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Assigned Students" })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "1BM22CS001" })).toBeVisible();
  });
});
