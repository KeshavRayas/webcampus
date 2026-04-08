import { test as base } from "@playwright/test";

type AuthFixtures = {
  adminCredentials: { email: string; password: string };
  facultyCredentials: { email: string; password: string };
  authenticatedAsAdmin: () => Promise<void>;
  authenticatedAsFaculty: () => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  adminCredentials: async ({}, use) => {
    await use({
      email: "hitishraop@gmail.com",
      password: "password",
    });
  },

  facultyCredentials: async ({}, use) => {
    await use({
      email: "faculty.cs@webcampus.com",
      password: "password",
    });
  },

  authenticatedAsAdmin: async ({ page, adminCredentials }, use) => {
    await use(async () => {
      await page.goto("/admin/sign-in");
      await page
        .locator('input[placeholder="Enter your email"]')
        .fill(adminCredentials.email);
      await page
        .locator('input[placeholder="Enter your password"]')
        .fill(adminCredentials.password);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL("/admin");
    });
  },

  authenticatedAsFaculty: async ({ page, facultyCredentials }, use) => {
    await use(async () => {
      await page.goto("/faculty/sign-in");
      await page
        .locator('input[placeholder="Enter your email"]')
        .fill(facultyCredentials.email);
      await page
        .locator('input[placeholder="Enter your password"]')
        .fill(facultyCredentials.password);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL("/faculty");
    });
  },
});
