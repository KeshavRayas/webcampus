import "dotenv/config";
import { faker } from "@faker-js/faker";
import { AdmissionService } from "@webcampus/api/src/services/admission/admission.service";
import { auth } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

const IMAGE_URL =
  "https://adminportal-fileupload.s3.ap-southeast-2.amazonaws.com/department_logo_39bc77d3-dc17-4679-952e-2bab6d716229.jpg";

const PDF_URL =
  "https://adminportal-fileupload.s3.ap-southeast-2.amazonaws.com/aadhar_card_0be79490-379c-4895-ae90-ab574a47b685.pdf";

interface ParsedArgs {
  count: number;
  departmentCode: string;
}

const parseCliArguments = (): ParsedArgs => {
  const args = process.argv.slice(2);
  const result: Partial<ParsedArgs> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count") {
      const countValue = args[i + 1];
      if (typeof countValue !== "string") {
        throw new Error(
          "Missing value for --count. Usage: npm run submit-mock-applicant --count <number> --dept <code>"
        );
      }

      const parsed = Number.parseInt(countValue, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.count = parsed;
      } else {
        throw new Error(
          `Invalid --count value: "${countValue}". Must be a positive integer.`
        );
      }
      i++;
    } else if (args[i] === "--dept") {
      const departmentValue = args[i + 1];
      if (typeof departmentValue !== "string") {
        throw new Error(
          "Missing value for --dept. Usage: npm run submit-mock-applicant --count <number> --dept <code>"
        );
      }

      result.departmentCode = departmentValue;
      i++;
    }
  }

  if (!result.count) {
    throw new Error(
      "Missing required parameter --count.\n" +
        "Usage: npm run submit-mock-applicant --count <number> --dept <code>\n" +
        "Example: npm run submit-mock-applicant --count 500 --dept CS"
    );
  }

  if (!result.departmentCode) {
    throw new Error(
      "Missing required parameter --dept.\n" +
        "Usage: npm run submit-mock-applicant --count <number> --dept <code>\n" +
        "Example: npm run submit-mock-applicant --count 500 --dept CS"
    );
  }

  return result as ParsedArgs;
};

const randomPhone = (serial: number): string => {
  const tail = String((serial % 1_000_000_000) + 1).padStart(9, "0");
  return `9${tail}`;
};

const deterministicAadhar = (serial: number): string => {
  const tail = String((serial % 100_000_000_000) + 1).padStart(11, "0");
  return `9${tail}`;
};

const extractNumericId = (applicationId: string): number | null => {
  const match = applicationId.match(/^APP(\d+)$/i);
  if (!match || !match[1]) {
    return null;
  }
  return Number.parseInt(match[1], 10);
};

const getNextApplicationNumber = async (): Promise<number> => {
  const rows = await db.admission.findMany({
    select: { applicationId: true },
    where: {
      applicationId: {
        startsWith: "APP",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });

  let maxNumber = 2026000;
  for (const row of rows) {
    const parsed = extractNumericId(row.applicationId);
    if (parsed && parsed > maxNumber) {
      maxNumber = parsed;
    }
  }

  return maxNumber + 1;
};

const resolveContext = async (departmentCode: string) => {
  const { ADMIN_USER_EMAIL, ADMIN_USER_PASSWORD } = backendEnv();

  const signInResponse = await auth.api.signInEmail({
    body: {
      email: ADMIN_USER_EMAIL,
      password: ADMIN_USER_PASSWORD,
    },
  });

  if (!signInResponse.token) {
    throw new Error("Admin sign-in failed: token missing");
  }

  const department = await db.department.findFirst({
    where: { code: departmentCode },
    select: { id: true, name: true, code: true },
  });

  if (!department) {
    // Fetch all available departments to show in error message
    const availableDepartments = await db.department.findMany({
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });

    const deptList = availableDepartments
      .map((d) => `${d.code} (${d.name})`)
      .join(", ");

    throw new Error(
      `Department with code "${departmentCode}" not found.\n` +
        `Available departments: ${deptList}`
    );
  }

  const term = await db.academicTerm.findFirst({
    where: {
      type: "odd",
      year: "2026",
    },
    select: { id: true },
  });

  if (!term) {
    throw new Error("Academic term odd 2026 not found");
  }

  const semester = await db.semester.findFirst({
    where: {
      academicTermId: term.id,
      programType: "UG",
      semesterNumber: 1,
    },
    select: { id: true },
  });

  if (!semester) {
    throw new Error("Semester odd 2026 UG 1 not found");
  }

  return {
    headers: { Authorization: `Bearer ${signInResponse.token}` },
    departmentId: department.id,
    semesterId: semester.id,
  };
};

const submitAndApprove = async (
  applicationId: string,
  serial: number,
  admissionId: string
): Promise<void> => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const fullName = `${firstName} ${lastName}`;

  const data: Record<string, string> = {
    firstName,
    lastName,
    nameAsPer10th: fullName,
    primaryEmail: `${applicationId.toLowerCase()}@example.edu`,
    primaryPhoneNumber: randomPhone(serial),
    aadharNumber: deterministicAadhar(serial),
    dob: faker.date
      .birthdate({ min: 17, max: 21, mode: "age" })
      .toISOString()
      .split("T")[0] as string,
    gender: faker.helpers.arrayElement(["Male", "Female"]),
    nationality: "Indian",
    motherTongue: faker.helpers.arrayElement(["Kannada", "English", "Hindi"]),
    religion: faker.helpers.arrayElement(["Hindu", "Muslim", "Christian"]),
    caste: faker.helpers.arrayElement(["General", "OBC", "SC", "ST"]),
  };

  const fileUrls: Record<string, string> = {
    photo: IMAGE_URL,
    aadharCard: PDF_URL,
    class10thMarksPdf: PDF_URL,
    class12thMarksPdf: PDF_URL,
  };

  const submitResponse = await AdmissionService.submitApplication(
    applicationId,
    data,
    fileUrls
  );

  if (submitResponse.status !== "success") {
    throw new Error(
      submitResponse.message || `Failed to submit application ${applicationId}`
    );
  }

  const approveResponse = await AdmissionService.approveAdmission({
    id: admissionId,
  });

  if (approveResponse.status !== "success") {
    throw new Error(
      approveResponse.message ||
        `Failed to approve application ${applicationId}`
    );
  }
};

async function main() {
  let args: ParsedArgs;
  try {
    args = parseCliArguments();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const context = await resolveContext(args.departmentCode);
  let nextApplicationNumber = await getNextApplicationNumber();
  let approvedCreated = 0;

  logger.info("Starting bulk applicant generation", {
    targetCount: args.count,
    modeOfAdmission: "KCET",
    department: args.departmentCode,
    term: "odd 2026",
    semester: "UG 1",
    quota: "MERIT",
    category: "GENERAL",
    porting: false,
  });

  while (approvedCreated < args.count) {
    const applicationId = `APP${nextApplicationNumber}`;
    nextApplicationNumber += 1;

    const existing = await db.admission.findFirst({
      where: {
        applicationId: {
          equals: applicationId,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      continue;
    }

    try {
      const shellResponse = await AdmissionService.createShell(
        {
          applicationId,
          modeOfAdmission: "KCET",
          semesterId: context.semesterId,
          departmentId: context.departmentId,
          categoryClaimed: "GENERAL",
          categoryAllotted: "GENERAL",
          quota: "MERIT",
        },
        context.headers
      );

      if (shellResponse.status !== "success") {
        throw new Error(
          shellResponse.message || `Failed to create shell for ${applicationId}`
        );
      }

      const admissionId =
        (shellResponse.data as { id?: string } | null)?.id ??
        (
          await db.admission.findFirst({
            where: {
              applicationId: {
                equals: applicationId,
                mode: "insensitive",
              },
            },
            select: { id: true },
          })
        )?.id;

      if (!admissionId) {
        throw new Error(`Admission id not found for ${applicationId}`);
      }

      await submitAndApprove(applicationId, nextApplicationNumber, admissionId);
      approvedCreated += 1;

      if (approvedCreated % 50 === 0 || approvedCreated === args.count) {
        logger.info("Bulk progress", {
          approvedCreated,
          targetCount: args.count,
          latestApplicationId: applicationId,
        });
      }
    } catch (error) {
      logger.warn("Skipping failed applicant and continuing", {
        applicationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Bulk applicant script completed", {
    approvedCreated,
    targetCount: args.count,
    status: "APPROVED",
    portingTriggered: false,
  });
}

main()
  .catch((error) => {
    logger.error("submit-mock-applicant failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
