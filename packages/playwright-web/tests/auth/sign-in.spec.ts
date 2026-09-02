import { expect } from "@playwright/test";
import { test } from "../fixtures/auth";

test.describe("Sign in page", () => {
  test("should render student sign in with email fields", async ({ page }) => {
    await page.goto("/student/sign-in");

    await expect(
      page.getByRole("heading", { name: /Student sign in/i })
    ).toBeVisible();
    await expect(page.getByLabel("Student Email")).toBeVisible();
    await expect(
      page.getByPlaceholder("Enter your student email")
    ).toBeVisible();
    await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
  });

  test("should render applicant sign in with email field", async ({ page }) => {
    await page.goto("/applicant/sign-in");

    await expect(
      page.getByRole("heading", { name: /Applicant sign in/i })
    ).toBeVisible();
    await expect(page.getByLabel("Primary Email/College Email")).toBeVisible();
    await expect(
      page.getByPlaceholder("Enter your primary email")
    ).toBeVisible();
    await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
  });

  test("should render admin sign in with all elements", async ({ page }) => {
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

  test("should sign in as admin successfully", async ({
    page,
    adminCredentials,
  }) => {
    await page.goto("/admin/sign-in");
    await expect(
      page.getByRole("heading", { name: /Admin sign in/i })
    ).toBeVisible();
    await page.getByLabel("Email").fill(adminCredentials.email);
    await page
      .getByPlaceholder("Enter your password")
      .fill(adminCredentials.password);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/admin");
    await expect(page.url()).toContain("/admin");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill("invalid@example.com");
    await page.getByPlaceholder("Enter your password").fill("wrongpassword");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should redirect admin to 403 page when accessing another role's dashboard", async ({
    page,
    authenticatedAsAdmin,
  }) => {
    await authenticatedAsAdmin();
    await page.goto("/student");
    await expect(
      page.getByRole("heading", { name: /Access Denied/i })
    ).toBeVisible();
    await expect(
      page.getByText(/You do not have permission to view this page/i)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Go to Homepage/i })
    ).toBeVisible();
    await expect(page.url()).toContain("/");
  });
});
