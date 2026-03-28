/**
 * Diagnostic script to identify and report username/admission-shell issues
 * 
 * This script helps identify:
 * 1. Applicants without proper username set
 * 2. Mismatched usernames vs application IDs
 * 3. Missing admission shells
 * 4. Suggests fixes for identified issues
 * 
 * Usage:
 * bunx tsx apps/api/scripts/diagnose-applicant-issues.ts
 */

import { db } from "@webcampus/db";
import { logger } from "@webcampus/common/logger";

async function diagnoseApplicantIssues() {
  console.log("\n========================================");
  console.log("APPLICANT DIAGNOSTIC REPORT");
  console.log("========================================\n");

  try {
    // 1. Find all applicant users
    console.log("1. FINDING ALL APPLICANT USERS...\n");
    const applicantUsers = await db.user.findMany({
      where: { role: "applicant" },
      select: {
        id: true,
        email: true,
        username: true,
        displayUsername: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`Found ${applicantUsers.length} applicant user(s)\n`);

    if (applicantUsers.length === 0) {
      console.log("✓ No applicant users found in database");
      return;
    }

    // 2. Check each applicant's admission shell
    console.log("2. CHECKING ADMISSION SHELLS...\n");

    const issues: Array<{
      userId: string;
      email: string;
      username: string | null;
      problem: string;
    }> = [];

    for (const user of applicantUsers) {
      console.log(`\nUser: ${user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Username: ${user.username || "(NULL)"}`);
      console.log(`  Display Name: ${user.displayUsername || "(not set)"}`);

      // Check if username is set
      if (!user.username) {
        console.log(
          "  ⚠️  ISSUE: Username is NULL - cannot find admission shell"
        );
        issues.push({
          userId: user.id,
          email: user.email,
          username: user.username,
          problem: "Username is NULL",
        });
        continue;
      }

      // Check if username is properly formatted (should be lowercase)
      const normalizedUsername = user.username.toLowerCase();
      if (user.username !== normalizedUsername) {
        console.log(
          `  ⚠️  ISSUE: Username not normalized - stored as "${user.username}" but should be "${normalizedUsername}"`
        );
        issues.push({
          userId: user.id,
          email: user.email,
          username: user.username,
          problem: `Username not normalized (${user.username} vs ${normalizedUsername})`,
        });
      }

      // Try to find admission shell
      const admission = await db.admission.findFirst({
        where: {
          applicationId: {
            equals: user.username,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          applicationId: true,
          status: true,
          departmentId: true,
          department: {
            select: { name: true },
          },
        },
      });

      if (!admission) {
        console.log(
          "  ✗ CRITICAL: No admission shell found for this user!"
        );
        issues.push({
          userId: user.id,
          email: user.email,
          username: user.username,
          problem: `No admission shell found for username: ${user.username}`,
        });
      } else {
        console.log(`  ✓ Admission shell found`);
        console.log(`    Application ID: ${admission.applicationId}`);
        console.log(`    Status: ${admission.status}`);
        console.log(`    Department: ${admission.department?.name || "UNKNOWN"}`);

        // Check if applicationId matches username exactly (case-insensitive)
        if (
          admission.applicationId.toLowerCase() !==
          user.username.toLowerCase()
        ) {
          console.log(
            `  ⚠️  ISSUE: Mismatch - admission has "${admission.applicationId}" but user has "${user.username}"`
          );
          issues.push({
            userId: user.id,
            email: user.email,
            username: user.username,
            problem: `Admission ID mismatch (${admission.applicationId} vs ${user.username})`,
          });
        }
      }
    }

    // 3. Summary and recommendations
    console.log("\n\n========================================");
    console.log("3. SUMMARY & RECOMMENDATIONS");
    console.log("========================================\n");

    if (issues.length === 0) {
      console.log("✓ No issues found! All applicants are properly configured.\n");
    } else {
      console.log(`Found ${issues.length} issue(s):\n`);

      for (const issue of issues) {
        console.log(`📌 ${issue.email}`);
        console.log(`   Problem: ${issue.problem}`);

        // Provide specific fix
        if (issue.problem === "Username is NULL") {
          console.log(
            `   Fix: Check if admission shell exists, then run backfill script`
          );
          console.log(
            `   SQL: UPDATE user SET username = LOWER('<applicationId>') WHERE id = '${issue.userId}';`
          );
        } else if (issue.problem.includes("not normalized")) {
          console.log(`   Fix: Run normalization backfill script`);
          console.log(
            `   SQL: UPDATE user SET username = LOWER('${issue.username}') WHERE id = '${issue.userId}';`
          );
        } else if (issue.problem.includes("No admission shell found")) {
          console.log(
            `   Fix: Admin must create admission shell for this applicant`
          );
        } else if (issue.problem.includes("Mismatch")) {
          console.log(`   Fix: Update username to match admission shell`);
          // Extract the correct ID from the admission shell
          const parts = issue.problem.match(/\((.+?)\s+vs/);
          if (parts) {
            const correctId = parts[1];
            console.log(
              `   SQL: UPDATE user SET username = LOWER('${correctId}') WHERE id = '${issue.userId}';`
            );
          }
        }
        console.log();
      }

      console.log("\nRECOMMENDED NEXT STEPS:");
      console.log(
        "1. Back up your database before running any SQL updates"
      );
      console.log(
        "2. Run: bunx tsx apps/api/scripts/backfill-applicant-usernames.ts --dry-run"
      );
      console.log("3. Review the changes and then run without --dry-run");
      console.log("4. Re-run this diagnostic script to verify fixes\n");
    }

    console.log("========================================\n");
  } catch (error) {
    logger.error("Diagnostic script failed:", error);
    console.error("Error:", error);
    process.exit(1);
  }
}

diagnoseApplicantIssues().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
