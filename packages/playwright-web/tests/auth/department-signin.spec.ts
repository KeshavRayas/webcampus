import { expect, test } from "@playwright/test";

test.describe("Department sign-in UI", () => {
  test("sign-in page loads with all elements", async ({ page }) => {
    await page.goto("/department/sign-in");
    await expect(
      page.getByRole("heading", { name: /Department sign in/i })
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
    await page.goto("/department/sign-in");
    await page
      .locator('input[placeholder="Enter your email"]')
      .fill("dept.cs@webcampus.com");
    await page
      .locator('input[placeholder="Enter your password"]')
      .fill("password");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/department");
    await expect(page.url()).toContain("/department");
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/department/sign-in");
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

  test("403 redirect on unauthorized route", async ({ page }) => {
    await page.goto("/department/sign-in");
    await page
      .locator('input[placeholder="Enter your email"]')
      .fill("dept.cs@webcampus.com");
    await page
      .locator('input[placeholder="Enter your password"]')
      .fill("password");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/department");
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: /Access Denied/i })
    ).toBeVisible();
  });
});
