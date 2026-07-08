import { expect, test } from "@playwright/test";

test.describe("Faculty sign-in UI", () => {
  test("sign-in page loads with all elements", async ({ page }) => {
    await page.goto("/faculty/sign-in");
    await expect(
      page.getByRole("heading", { name: /Faculty sign in/i })
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Enter your email"]')
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Enter your password"]')
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.goto("/faculty/sign-in");
    await page
      .locator('input[placeholder="Enter your email"]')
      .fill("faculty.cs@webcampus.com");
    await page
      .locator('input[placeholder="Enter your password"]')
      .fill("password");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/faculty");
    await expect(page.url()).toContain("/faculty");
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/faculty/sign-in");
    await page
      .locator('input[placeholder="Enter your email"]')
      .fill("wrong@test.com");
    await page
      .locator('input[placeholder="Enter your password"]')
      .fill("wrongpass");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(/Invalid|error|incorrect|failed/i)
    ).toBeVisible();
  });
});
