import "dotenv/config";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  normalizeStudentEmailToken,
  splitStudentName,
} from "../src/services/admission/student-email";

type CurrentStudentRow = {
  id: string;
  userId: string;
  department: {
    code: string;
  };
  academicYear: string;
  admission: {
    applicationId: string;
    nameAsPer10th: string | null;
    semester: {
      academicTerm: {
        year: string;
      };
    };
  } | null;
  user: {
    email: string;
  };
};

const getSortableName = (student: CurrentStudentRow): string => {
  const admission = student.admission;
  if (!admission) {
    return "";
  }

  return admission.nameAsPer10th?.trim().toLocaleLowerCase() ?? "";
};

const getAcademicYearSuffix = (academicYear: string): string => {
  const digits = academicYear.replace(/\D/g, "");
  if (digits.length < 2) {
    throw new Error(
      `Invalid academic year for student email backfill: ${academicYear}`
    );
  }

  return digits.slice(-2);
};

const getGroupKey = (departmentCode: string, academicYear: string): string => {
  return `${normalizeStudentEmailToken(departmentCode)}:${getAcademicYearSuffix(academicYear)}`;
};

const buildTargetEmail = (
  student: CurrentStudentRow,
  occupiedLocalParts: Set<string>
): string => {
  const admission = student.admission;
  if (!admission) {
    throw new Error(
      `Cannot backfill student ${student.id}: admission record is missing`
    );
  }

  const { firstName, lastName, middleName } = splitStudentName(
    admission.nameAsPer10th ?? ""
  );
  if (!firstName) {
    throw new Error(
      `Cannot backfill student ${student.id}: first name is missing`
    );
  }

  const academicYear = admission.semester.academicTerm.year;
  const yearSuffix = getAcademicYearSuffix(academicYear);
  const departmentCode = normalizeStudentEmailToken(student.department.code);
  const normalizedFirstName = normalizeStudentEmailToken(firstName);

  if (!normalizedFirstName) {
    throw new Error(
      `Cannot backfill student ${student.id}: first name is invalid`
    );
  }

  const suffix = `${departmentCode}${yearSuffix}`;
  const baseLocalPart = `${normalizedFirstName}.${suffix}`;
  if (!occupiedLocalParts.has(baseLocalPart)) {
    return `${baseLocalPart}@bmsce.ac.in`;
  }

  const disambiguators = Array.from(
    new Set(
      [
        normalizeStudentEmailToken(lastName).slice(0, 1),
        normalizeStudentEmailToken(middleName).slice(0, 1),
      ].filter((value) => Boolean(value))
    )
  );

  for (const disambiguator of disambiguators) {
    const localPart = `${normalizedFirstName}${disambiguator}.${suffix}`;
    if (!occupiedLocalParts.has(localPart)) {
      return `${localPart}@bmsce.ac.in`;
    }
  }

  for (let suffixIndex = 1; ; suffixIndex += 1) {
    const localPart = `${normalizedFirstName}${disambiguators[0] ?? ""}${suffixIndex}.${suffix}`;
    if (!occupiedLocalParts.has(localPart)) {
      return `${localPart}@bmsce.ac.in`;
    }
  }
};

const loadOccupiedLocalPartsByGroup = async (
  students: CurrentStudentRow[]
): Promise<Map<string, Set<string>>> => {
  const occupiedLocalPartsByGroup = new Map<string, Set<string>>();
  const studentUserIds = new Set(students.map((student) => student.userId));
  const groupKeys = Array.from(
    new Set(
      students.map((student) =>
        getGroupKey(student.department.code, student.academicYear)
      )
    )
  );

  for (const groupKey of groupKeys) {
    const [departmentCode, yearSuffix] = groupKey.split(":");
    if (!departmentCode || !yearSuffix) {
      continue;
    }

    const existingEmails = await db.user.findMany({
      where: {
        id: {
          notIn: Array.from(studentUserIds),
        },
        email: {
          endsWith: `.${departmentCode}${yearSuffix}@bmsce.ac.in`,
          mode: "insensitive",
        },
      },
      select: {
        email: true,
      },
    });

    occupiedLocalPartsByGroup.set(
      groupKey,
      new Set(
        existingEmails.map(
          (user) => user.email.trim().toLowerCase().split("@")[0] ?? ""
        )
      )
    );
  }

  return occupiedLocalPartsByGroup;
};

export async function backfillCurrentStudentEmails(options?: {
  dryRun?: boolean;
}): Promise<{ scannedCount: number; updatedCount: number }> {
  const dryRun = options?.dryRun ?? false;

  const students = (await db.student.findMany({
    where: {
      user: {
        role: "student",
      },
      admission: {
        isNot: null,
      },
    },
    select: {
      id: true,
      userId: true,
      department: {
        select: {
          code: true,
        },
      },
      academicYear: true,
      admission: {
        select: {
          applicationId: true,
          nameAsPer10th: true,
          semester: {
            select: {
              academicTerm: {
                select: {
                  year: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: {
          email: true,
        },
      },
    },
  })) as CurrentStudentRow[];

  students.sort((left, right) => {
    const leftName = getSortableName(left);
    const rightName = getSortableName(right);

    if (leftName !== rightName) {
      return leftName.localeCompare(rightName);
    }

    return (
      left.admission?.applicationId.localeCompare(
        right.admission?.applicationId ?? ""
      ) ?? 0
    );
  });

  const occupiedLocalPartsByGroup =
    await loadOccupiedLocalPartsByGroup(students);

  let updatedCount = 0;

  for (const student of students) {
    const admission = student.admission;
    if (!admission) {
      throw new Error(
        `Cannot backfill student ${student.id}: admission record is missing`
      );
    }

    const academicYear = admission.semester.academicTerm.year;
    const groupKey = getGroupKey(student.department.code, academicYear);
    let occupiedLocalParts = occupiedLocalPartsByGroup.get(groupKey);
    if (!occupiedLocalParts) {
      occupiedLocalParts = new Set<string>();
      occupiedLocalPartsByGroup.set(groupKey, occupiedLocalParts);
    }

    const nextEmail = buildTargetEmail(student, occupiedLocalParts);

    const currentEmail = student.user.email.trim().toLowerCase();
    if (currentEmail === nextEmail.toLowerCase()) {
      occupiedLocalParts.add(nextEmail.split("@")[0] ?? nextEmail);
      continue;
    }

    if (dryRun) {
      logger.info("Would update student email", {
        studentId: student.id,
        userId: student.userId,
        from: student.user.email,
        to: nextEmail,
      });
    } else {
      await db.user.update({
        where: { id: student.userId },
        data: {
          email: nextEmail,
        },
      });
    }

    updatedCount += 1;
    occupiedLocalParts.add(nextEmail.split("@")[0] ?? nextEmail);
  }

  logger.info("Current student email backfill complete", {
    scannedCount: students.length,
    updatedCount,
    dryRun,
  });

  return {
    scannedCount: students.length,
    updatedCount,
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  try {
    await backfillCurrentStudentEmails({ dryRun });
  } catch (error) {
    logger.error("Current student email backfill failed", { error });
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.main) {
  await main();
}
