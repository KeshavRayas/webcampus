import { defineConfig, devices } from "@playwright/test";

process.env.NEXT_PUBLIC_API_BASE_URL ??= "http://localhost:8080";
process.env.NEXT_PUBLIC_FRONTEND_URL ??= "http://localhost:3000";

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Specs share the dev database, better-auth signup rate limits and
  // per-faculty attendance-overlap state — parallel workers corrupt runs.
  workers: 1,
  reporter: "html",
  timeout: 60_000,
  globalSetup: "./tests/global.setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "auth-ui",
      testDir: "tests/auth",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin",
      testDir: "tests/admin",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/admin.json" },
    },
    {
      name: "department",
      testDir: "tests/department",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/department.json",
      },
    },
    {
      name: "faculty",
      testDir: "tests/faculty",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/faculty.json" },
    },
    {
      name: "admission",
      testDir: "tests/admission",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/admin.json" },
    },
    {
      name: "hod",
      testDir: "tests/hod",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/department.json",
      },
    },
    {
      name: "workflow",
      testDir: "tests/workflow",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "protected",
      testDir: "tests/protected",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/admin.json" },
    },
    {
      name: "academic-backlog",
      testDir: "tests/academic-backlog",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "cd ../../apps/web && bun run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
