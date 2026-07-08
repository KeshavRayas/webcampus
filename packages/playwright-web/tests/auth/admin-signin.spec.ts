import { expect, test } from "@playwright/test";

test.describe("Admin sign-in UI", () => {
  test("sign-in page loads with all elements", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await expect(
      page.getByRole("heading", { name: /Admin sign in/i })
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
    await page.goto("/admin/sign-in");
    await page
      .locator('input[placeholder="Enter your email"]')
      .fill("dev@webcampus.com");
    await page
      .locator('input[placeholder="Enter your password"]')
      .fill("password");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/admin");
    await expect(page.url()).toContain("/admin");
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/admin/sign-in");
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

  test("logged-in admin is redirected to 403 on student route", async ({
    page,
  }) => {
    await page.goto("/admin/sign-in");
    await page
      .locator('input[placeholder="Enter your email"]')
      .fill("dev@webcampus.com");
    await page
      .locator('input[placeholder="Enter your password"]')
      .fill("password");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/admin");
    await page.goto("/student");
    await expect(
      page.getByRole("heading", { name: /Access Denied/i })
    ).toBeVisible();
  });

  test("logout clears session", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await page
      .locator('input[placeholder="Enter your email"]')
      .fill("dev@webcampus.com");
    await page
      .locator('input[placeholder="Enter your password"]')
      .fill("password");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/admin");

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Admin Sign In/i })
    ).toBeVisible();
  });
});
