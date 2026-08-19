import "dotenv/config";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import { redis } from "@webcampus/common/redis";
import { db } from "@webcampus/db";
import { CreateUserType } from "@webcampus/schemas/admin";

// CI-ONLY seeding for the ephemeral Playwright stack.
// Creates the exact users packages/playwright-web signs in as.
// Must NEVER be run on a real server — the deployed server gets its users
// created manually (bootstrap/admin UI); the deploy pipeline runs migrations
// only.
const CI_USERS: CreateUserType[] = [
  {
    name: "CS Department",
    email: "dept.cs@webcampus.com",
    username: "dept.cs",
    password: "password",
    role: "department",
  },
  {
    name: "CS Faculty",
    email: "faculty.cs@webcampus.com",
    username: "faculty.cs",
    password: "password",
    role: "faculty",
  },
];

async function main() {
  const { ADMIN_USER_EMAIL, ADMIN_USER_PASSWORD } = backendEnv();
  const response = await auth.api.signInEmail({
    body: { email: ADMIN_USER_EMAIL, password: ADMIN_USER_PASSWORD },
  });
  if (!response.token) {
    throw new Error("CI seed: admin sign-in returned no token.");
  }
  const token = response.token;

  for (const userData of CI_USERS) {
    try {
      const service = new UserService({
        request: userData,
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await service.create();
      if (result.status === "error") {
        throw new Error(result.message);
      }
      logger.info(`CI seed: created ${userData.email}`);
    } catch (error) {
      logger.info(
        `CI seed: skipped ${userData.email} (${(error as Error).message})`
      );
    }
  }
}

main()
  .catch((error) => {
    logger.error(`CI seed failed: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([redis.quit(), db.$disconnect()]);
  });
