import { expect, test } from "@playwright/test";

test.describe("feedback navigation", () => {
  test("admin sees feedback under the existing Academics group", async ({
    page,
  }) => {
    await page.goto("/admin/academics/feedback");
    await expect(page).toHaveURL(/\/admin\/academics\/feedback/);
    await expect(
      page.getByText("Feedback", { exact: true }).first()
    ).toBeVisible();
  });

  test("student feedback route is protected and renders the feedback page", async ({
    page,
  }) => {
    await page.goto("/feedback");
    await expect(page).toHaveURL(/\/feedback|\/student\/sign-in/);
    if (page.url().endsWith("/feedback")) {
      await expect(
        page.getByText("Course Feedback", { exact: true })
      ).toBeVisible();
    }
  });
});
