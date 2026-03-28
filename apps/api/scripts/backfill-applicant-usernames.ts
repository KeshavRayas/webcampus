/**
 * Backfill script to normalize existing applicant usernames to lowercase.
 *
 * Background:
 * Better Auth username plugin normalizes usernames to lowercase during sign-in.
 * Prior to the fix, applicant usernames were stored in mixed/uppercase case,
 * causing sign-in failures with "invalid username or password".
 *
 * This script finds all applicant users with non-normalized (non-lowercase) usernames
 * and normalizes them, ensuring existing accounts can sign in successfully.
 *
 * Usage:
 * bunx tsx apps/api/scripts/backfill-applicant-usernames.ts [--dry-run]
 */

import { db } from "@webcampus/db";
import { logger } from "@webcampus/common/logger";

async function backfillApplicantUsernames() {
  const dryRun = process.argv.includes("--dry-run");

  logger.info(
    `Starting applicant username backfill${dryRun ? " (DRY RUN)" : ""}...`
  );

  try {
    // Find all applicant users whose username doesn't match lowercase version
    const applicantsNeedingNormalization = await db.user.findMany({
      where: {
        role: "applicant",
        username: {
          not: null,
        },
      },
      select: {
        id: true,
        username: true,
        displayUsername: true,
        name: true,
        email: true,
      },
    });

    // Filter to those with non-normalized usernames
    const toNormalize = applicantsNeedingNormalization.filter((user) => {
      const normalizedUsername = user.username?.toLowerCase();
      return user.username && normalizedUsername !== user.username;
    });

    logger.info(
      `Found ${toNormalize.length} applicant user(s) with non-normalized usernames`
    );

    if (toNormalize.length === 0) {
      logger.info("No applicant usernames need normalization. Exiting.");
      return;
    }

    // Log each user that will be normalized
    for (const user of toNormalize) {
      logger.info(`  ${user.email}: "${user.username}" → "${user.username?.toLowerCase()}"`);
    }

    if (dryRun) {
      logger.info(`DRY RUN: Would update ${toNormalize.length} user(s).`);
      return;
    }

    // Perform normalization
    let updated = 0;
    const errors: Array<{ user: string; error: string }> = [];

    for (const user of toNormalize) {
      try {
        const normalizedUsername = user.username!.toLowerCase();
        await db.user.update({
          where: { id: user.id },
          data: { username: normalizedUsername },
        });
        logger.info(
          `✓ Updated ${user.email}: username normalized to "${normalizedUsername}"`
        );
        updated++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`✗ Failed to update ${user.email}: ${msg}`);
        errors.push({
          user: user.email,
          error: msg,
        });
      }
    }

    logger.info(
      `\nBackfill complete: ${updated}/${toNormalize.length} user(s) updated successfully`
    );

    if (errors.length > 0) {
      logger.error(`${errors.length} error(s) encountered:`);
      for (const err of errors) {
        logger.error(`  - ${err.user}: ${err.error}`);
      }
    }
  } catch (error) {
    logger.error("Backfill script failed:", error);
    process.exit(1);
  }
}

backfillApplicantUsernames().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
