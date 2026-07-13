import { chromium } from "@playwright/test";

const DEFAULT_PASSWORD = "password";
const ADMIN_EMAIL = process.env.ADMIN_USER_EMAIL || "dev@webcampus.com";
const ADMIN_PASSWORD = process.env.ADMIN_USER_PASSWORD || DEFAULT_PASSWORD;

type RoleConfig = {
  email: string;
  password: string;
  statePath: string;
  signInPath: string;
  redirectContain: string;
};

const ROLES: RoleConfig[] = [
  {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    statePath: ".auth/admin.json",
    signInPath: "/admin/sign-in",
    redirectContain: "/admin",
  },
  {
    email: "dept.cs@webcampus.com",
    password: DEFAULT_PASSWORD,
    statePath: ".auth/department.json",
    signInPath: "/department/sign-in",
    redirectContain: "/department",
  },
  {
    email: "faculty.cs@webcampus.com",
    password: DEFAULT_PASSWORD,
    statePath: ".auth/faculty.json",
    signInPath: "/faculty/sign-in",
    redirectContain: "/faculty",
  },
];

async function authenticateRole(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  role: RoleConfig
) {
  const page = await browser.newPage({ baseURL: "http://localhost:3000" });
  await page.goto(role.signInPath);
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Enter your email"]').fill(role.email);
  await page
    .locator('input[placeholder="Enter your password"]')
    .fill(role.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(`**${role.redirectContain}`, { timeout: 15_000 });
  await page.context().storageState({ path: role.statePath });
  await page.close();
}

async function globalSetup() {
  const browser = await chromium.launch();
  for (const role of ROLES) {
    await authenticateRole(browser, role);
  }
  await browser.close();
}

export default globalSetup;
