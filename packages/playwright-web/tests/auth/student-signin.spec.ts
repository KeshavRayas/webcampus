import { expect, test } from "@playwright/test";

test.describe("Student sign-in UI", () => {
  test("sign-in page loads with all elements", async ({ page }) => {
    await page.goto("/student/sign-in");
    await expect(
      page.getByRole("heading", { name: /Student sign in/i })
    ).toBeVisible();
    await expect(page.getByLabel("Student Email")).toBeVisible();
    await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/student/sign-in");
    await page.getByLabel("Student Email").fill("wrong@test.com");
    await page.getByPlaceholder("Enter your password").fill("wrongpass");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Invalid|error|incorrect|failed/i)).toBeVisible(
      { timeout: 10000 }
    );
  });
});
