import "dotenv/config";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

type AdmissionForRewrite = {
  id: string;
  applicationId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  tempUsn: string | null;
  studentId: string | null;
  semester: {
    academicTerm: {
      year: string;
    };
  };
  department: {
    code: string;
  };
};

const getNormalizedBranchCode = (code: string): string => {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 4);
  if (!normalized) {
    throw new Error(`Invalid department code for USN generation: ${code}`);
  }

  return normalized;
};

const getYearSuffix = (year: string): string => {
  const digits = year.replace(/\D/g, "");
  if (digits.length < 2) {
    throw new Error(`Invalid academic year for USN generation: ${year}`);
  }

  return digits.slice(-2);
};

const getSortableName = (admission: AdmissionForRewrite): string => {
  return [admission.firstName, admission.middleName, admission.lastName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase();
};

const buildTempUsn = (yearSuffix: string, branchCode: string, serial: number): string => {
  return `TBM${yearSuffix}${branchCode}${serial.toString().padStart(4, "0")}`;
};

async function rewriteAdmissionAndStudentUsn(): Promise<void> {
  const prisma = db as any;

  const admissions = (await prisma.admission.findMany({
    where: {
      OR: [{ tempUsn: { not: null } }, { studentId: { not: null } }],
    },
    select: {
      id: true,
      applicationId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      tempUsn: true,
      studentId: true,
      semester: {
        select: {
          academicTerm: {
            select: {
              year: true,
            },
          },
        },
      },
      department: {
        select: {
          code: true,
        },
      },
    },
  })) as AdmissionForRewrite[];

  if (admissions.length === 0) {
    logger.info("No admissions found for USN rewrite");
    return;
  }

  const groupedAdmissions = new Map<string, AdmissionForRewrite[]>();
  for (const admission of admissions) {
    const yearSuffix = getYearSuffix(admission.semester.academicTerm.year);
    const branchCode = getNormalizedBranchCode(admission.department.code);
    const key = `${yearSuffix}:${branchCode}`;

    const current = groupedAdmissions.get(key) || [];
    current.push(admission);
    groupedAdmissions.set(key, current);
  }

  const admissionTempUsnUpdates: Array<{ admissionId: string; tempUsn: string }> = [];
  const studentUsnByStudentId = new Map<string, string>();

  for (const [key, group] of groupedAdmissions.entries()) {
    const [yearSuffix, branchCode] = key.split(":");
    if (!yearSuffix || !branchCode) {
      throw new Error(`Invalid rewrite partition key: ${key}`);
    }

    group.sort((left, right) => {
      const leftName = getSortableName(left);
      const rightName = getSortableName(right);

      if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
      }

      return left.applicationId.localeCompare(right.applicationId);
    });

    for (let index = 0; index < group.length; index += 1) {
      const admission = group[index];
      if (!admission) {
        continue;
      }
      const nextTempUsn = buildTempUsn(yearSuffix, branchCode, index + 1);

      admissionTempUsnUpdates.push({
        admissionId: admission.id,
        tempUsn: nextTempUsn,
      });

      if (!admission.studentId) {
        continue;
      }

      const existing = studentUsnByStudentId.get(admission.studentId);
      if (existing && existing !== nextTempUsn) {
        throw new Error(
          `Student ${admission.studentId} mapped to multiple admissions with conflicting USNs`
        );
      }

      studentUsnByStudentId.set(admission.studentId, nextTempUsn);
    }
  }

  await db.$transaction(async (tx) => {
    for (const update of admissionTempUsnUpdates) {
      await tx.admission.update({
        where: { id: update.admissionId },
        data: { tempUsn: update.tempUsn },
      });
    }

    const students = await tx.student.findMany({
      where: {
        id: { in: Array.from(studentUsnByStudentId.keys()) },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    for (const student of students) {
      const nextUsn = studentUsnByStudentId.get(student.id);
      if (!nextUsn) {
        continue;
      }

      await tx.student.update({
        where: { id: student.id },
        data: { usn: nextUsn },
      });

      await tx.user.update({
        where: { id: student.userId },
        data: { username: nextUsn },
      });
    }
  });

  logger.info("Admission and student USN rewrite completed", {
    admissionsUpdated: admissionTempUsnUpdates.length,
    studentsUpdated: studentUsnByStudentId.size,
  });
}

(async () => {
  try {
    await rewriteAdmissionAndStudentUsn();
  } catch (error) {
    logger.error("Failed to rewrite admission/student USN values", { error });
    process.exit(1);
  }
})();
