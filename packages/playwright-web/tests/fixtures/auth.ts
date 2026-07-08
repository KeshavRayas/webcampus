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
      email: process.env.ADMIN_USER_EMAIL || "dev@webcampus.com",
      password: process.env.ADMIN_USER_PASSWORD || "password",
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
      await page.getByLabel("Email").fill(adminCredentials.email);
      await page
        .getByPlaceholder("Enter your password")
        .fill(adminCredentials.password);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL("/admin");
    });
  },

  authenticatedAsFaculty: async ({ page, facultyCredentials }, use) => {
    await use(async () => {
      await page.goto("/faculty/sign-in");
      await page.getByLabel("Email").fill(facultyCredentials.email);
      await page
        .getByPlaceholder("Enter your password")
        .fill(facultyCredentials.password);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL("/faculty");
    });
  },
});
