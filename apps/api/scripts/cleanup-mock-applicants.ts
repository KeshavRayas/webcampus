import "dotenv/config";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

interface ParsedArgs {
  departmentCode?: string;
  dryRun: boolean;
}

const parseCliArguments = (): ParsedArgs => {
  const args = process.argv.slice(2);
  const result: ParsedArgs = { dryRun: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dept" && i + 1 < args.length) {
      result.departmentCode = args[i + 1];
      i++;
      continue;
    }

    if (args[i] === "--dry-run") {
      result.dryRun = true;
    }
  }

  return result;
};

async function cleanupMockApplicants() {
  const args = parseCliArguments();

  // Build the where clause for filtering admissions
  const admissionWhere = args.departmentCode
    ? {
        department: {
          code: args.departmentCode,
        },
      }
    : {};

  // Get all admissions that match the filter
  const admissionsToDelete = await db.admission.findMany({
    where: admissionWhere,
    select: {
      id: true,
      applicationId: true,
      studentId: true,
      primaryEmail: true,
      status: true,
      department: { select: { code: true, name: true } },
    },
  });

  if (admissionsToDelete.length === 0) {
    logger.info("No applicants found to delete", {
      department: args.departmentCode ?? "all",
    });
    return;
  }

  logger.info("Starting cleanup", {
    dryRun: args.dryRun,
    totalAdmissions: admissionsToDelete.length,
    department: args.departmentCode ?? "all",
  });

  const targetStudentIds = Array.from(
    new Set(
      admissionsToDelete
        .map((admission) => admission.studentId)
        .filter((studentId): studentId is string => Boolean(studentId))
    )
  );

  const normalizedApplicationIds = Array.from(
    new Set(
      admissionsToDelete.map((admission) =>
        admission.applicationId.trim().toLowerCase()
      )
    )
  );

  const applicantLocalEmails = normalizedApplicationIds.map(
    (appId) => `${appId}@applicant.local`
  );

  const primaryEmails = Array.from(
    new Set(
      admissionsToDelete
        .map((admission) => admission.primaryEmail?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email))
    )
  );

  const studentsInScope = targetStudentIds.length
    ? await db.student.findMany({
        where: { id: { in: targetStudentIds } },
        select: { id: true, userId: true },
      })
    : [];

  const studentUserIds = studentsInScope.map((student) => student.userId);

  const usernameOrFilters = normalizedApplicationIds.map((applicationId) => ({
    username: { equals: applicationId, mode: "insensitive" as const },
  }));

  const applicantUsersByIdentity = await db.user.findMany({
    where: {
      OR: [
        ...usernameOrFilters,
        ...(applicantLocalEmails.length > 0
          ? [{ email: { in: applicantLocalEmails } }]
          : []),
        ...(primaryEmails.length > 0 ? [{ email: { in: primaryEmails } }] : []),
      ],
    },
    select: { id: true },
  });

  const candidateUserIds = Array.from(
    new Set([
      ...studentUserIds,
      ...applicantUsersByIdentity.map((user) => user.id),
    ])
  );

  if (candidateUserIds.length === 0) {
    logger.warn("No related users resolved for cleanup scope", {
      totalAdmissions: admissionsToDelete.length,
      totalStudents: targetStudentIds.length,
      department: args.departmentCode ?? "all",
      dryRun: args.dryRun,
    });
  }

  const candidateUsers = candidateUserIds.length
    ? await db.user.findMany({
        where: { id: { in: candidateUserIds } },
        select: {
          id: true,
          role: true,
          email: true,
          username: true,
          student: { select: { id: true } },
          admin: { select: { id: true } },
          faculty: { select: { id: true } },
          hod: { select: { id: true } },
          coe: { select: { id: true } },
        },
      })
    : [];

  const targetStudentIdSet = new Set(targetStudentIds);

  const safeUsersToDelete = candidateUsers.filter((user) => {
    const role = (user.role ?? "").toLowerCase();
    if (role !== "applicant" && role !== "student") {
      return false;
    }

    if (user.admin || user.faculty || user.hod || user.coe) {
      return false;
    }

    if (user.student && !targetStudentIdSet.has(user.student.id)) {
      return false;
    }

    return true;
  });

  const safeUserIdSet = new Set(safeUsersToDelete.map((user) => user.id));

  const skippedUsers = candidateUsers.filter(
    (user) => !safeUserIdSet.has(user.id)
  );

  if (args.dryRun) {
    logger.info("Cleanup dry-run summary", {
      totalAdmissions: admissionsToDelete.length,
      totalStudentsInScope: targetStudentIds.length,
      candidateUsers: candidateUsers.length,
      safeUsersToDelete: safeUsersToDelete.length,
      skippedUsers: skippedUsers.length,
      department: args.departmentCode ?? "all",
    });

    if (skippedUsers.length > 0) {
      logger.warn("Users skipped by safety rules", {
        sample: skippedUsers.slice(0, 10).map((user) => ({
          id: user.id,
          role: user.role,
          email: user.email,
          username: user.username,
          hasStudent: Boolean(user.student),
          hasAdmin: Boolean(user.admin),
          hasFaculty: Boolean(user.faculty),
          hasHod: Boolean(user.hod),
          hasCoe: Boolean(user.coe),
        })),
      });
    }

    return;
  }

  let deletedStudents = 0;
  let deletedAdmissions = 0;
  let deletedUsers = 0;
  const deleteErrors: { applicationId: string; reason: string }[] = [];

  for (const admission of admissionsToDelete) {
    try {
      await db.admission.delete({
        where: { id: admission.id },
      });
      deletedAdmissions += 1;

      if (
        deletedAdmissions % 50 === 0 ||
        deletedAdmissions === admissionsToDelete.length
      ) {
        logger.info("Cleanup progress", {
          deletedAdmissions,
          deletedStudents,
          totalAdmissions: admissionsToDelete.length,
          latestApplicationId: admission.applicationId,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn("Failed to delete admission", {
        applicationId: admission.applicationId,
        error: errorMsg,
      });
      deleteErrors.push({
        applicationId: admission.applicationId,
        reason: errorMsg,
      });
    }
  }

  for (const studentId of targetStudentIds) {
    try {
      await db.student.delete({
        where: { id: studentId },
      });
      deletedStudents += 1;
    } catch (error) {
      logger.warn("Failed to delete student", {
        studentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const user of safeUsersToDelete) {
    try {
      await db.user.delete({
        where: { id: user.id },
      });
      deletedUsers += 1;
    } catch (error) {
      logger.warn("Failed to delete related user", {
        userId: user.id,
        role: user.role,
        email: user.email,
        username: user.username,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Cleanup completed", {
    deletedAdmissions,
    deletedStudents,
    deletedUsers,
    skippedUsers: skippedUsers.length,
    failedDeletions: deleteErrors.length,
    department: args.departmentCode ?? "all",
  });

  if (deleteErrors.length > 0) {
    logger.warn("Some deletions failed", {
      failedCount: deleteErrors.length,
      errors: deleteErrors.slice(0, 10),
    });
  }
}

cleanupMockApplicants()
  .catch((error) => {
    logger.error("Cleanup script failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
