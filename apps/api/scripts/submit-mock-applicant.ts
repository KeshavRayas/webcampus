import "dotenv/config";
import { faker } from "@faker-js/faker";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
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
  port: boolean;
}

const parseCliArguments = (): ParsedArgs => {
  const args = process.argv.slice(2);
  const result: Partial<ParsedArgs> = { port: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count") {
      const countValue = args[i + 1];
      if (typeof countValue !== "string") {
        throw new Error(
          "Missing value for --count. Usage: npm run submit-mock-applicant --count <number> --dept <code> [--port]"
        );
      }

      const parsed = Number.parseInt(countValue, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        result.count = parsed;
      } else {
        throw new Error(
          `Invalid --count value: "${countValue}". Must be a non-negative integer.`
        );
      }
      i++;
    } else if (args[i] === "--dept") {
      const departmentValue = args[i + 1];
      if (typeof departmentValue !== "string") {
        throw new Error(
          "Missing value for --dept. Usage: npm run submit-mock-applicant --count <number> --dept <code> [--port]"
        );
      }

      result.departmentCode = departmentValue;
      i++;
    } else if (args[i] === "--port" || args[i]?.startsWith("--port=")) {
      const portFlag = args[i]!;
      const inlineValue = portFlag.split("=")[1];
      if (inlineValue !== undefined) {
        result.port = /^(on|1|true|yes)$/i.test(inlineValue);
      } else {
        const next = args[i + 1];
        if (next && /^(on|off|1|0|true|false|yes|no)$/i.test(next)) {
          result.port = /^(on|1|true|yes)$/i.test(next);
          i++;
        } else {
          result.port = true;
        }
      }
    }
  }

  if (result.count === undefined) {
    throw new Error(
      "Missing required parameter --count.\n" +
        "Usage: npm run submit-mock-applicant --count <number> --dept <code> [--port]\n" +
        "Example: npm run submit-mock-applicant --count 500 --dept CS\n" +
        "Example: npm run submit-mock-applicant --count 100 --dept CS --port"
    );
  }

  if (!result.departmentCode) {
    throw new Error(
      "Missing required parameter --dept.\n" +
        "Usage: npm run submit-mock-applicant --count <number> --dept <code> [--port]\n" +
        "Example: npm run submit-mock-applicant --count 500 --dept CS\n" +
        "Example: npm run submit-mock-applicant --count 100 --dept CS --port"
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

const cleanupPartialApplicant = async (
  email: string,
  removeApplicantUser: boolean
): Promise<void> => {
  try {
    await db.admission.deleteMany({
      where: { primaryEmail: email },
    });

    if (removeApplicantUser) {
      const applicant = await db.user.findFirst({
        where: { email, role: "applicant" },
        select: { id: true },
      });

      if (applicant) {
        await db.user.delete({ where: { id: applicant.id } });
      }
    }
  } catch (cleanupError) {
    logger.error("Failed to clean up partial mock applicant", {
      email,
      cleanupError,
    });
  }
};

const ADMISSION_INSTRUCTOR = {
  name: "admission-instructor",
  email: "admission-instructor@webcampus.com",
  username: "admission-instructor",
  password: "password",
} as const;

const ensureInstructorUser = async (adminHeaders: {
  Authorization: string;
}): Promise<string> => {
  const existing = await db.user.findUnique({
    where: { email: ADMISSION_INSTRUCTOR.email },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const userService = new UserService({
    request: {
      ...ADMISSION_INSTRUCTOR,
      role: "admission-instructor",
    },
    headers: adminHeaders,
  });

  const response = await userService.create();
  if (response.status === "error" || !response.data?.id) {
    throw new Error(
      response.message || "Failed to create admission-instructor user"
    );
  }

  logger.info("Admission instructor user created by mock script", {
    id: response.data.id,
  });
  return response.data.id;
};

const resolveContext = async (departmentCode: string) => {
  const { ADMIN_USER_EMAIL, ADMIN_USER_PASSWORD } = backendEnv();

  const adminSignIn = await auth.api.signInEmail({
    body: {
      email: ADMIN_USER_EMAIL,
      password: ADMIN_USER_PASSWORD,
    },
  });

  if (!adminSignIn.token) {
    throw new Error("Admin sign-in failed: token missing");
  }

  const adminHeaders = { Authorization: `Bearer ${adminSignIn.token}` };
  const filledById = await ensureInstructorUser(adminHeaders);

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
    headers: adminHeaders,
    filledById,
    departmentId: department.id,
    semesterId: semester.id,
  };
};

const submitAndApprove = async (
  email: string,
  serial: number,
  admissionId: string,
  fullName: string,
  filledById: string,
  departmentId: string,
  semesterId: string
): Promise<void> => {
  const data: Record<string, string> = {
    nameAsPer10th: fullName,
    modeOfAdmission: "KCET",
    categoryClaimed: "GM",
    categoryAllotted: "GM",
    quota: "CET-AIDED",
    primaryEmail: email,
    semesterId,
    departmentId,
    admissionType: "REGULAR",
    scholarship: "false",
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
    email,
    data,
    fileUrls,
    filledById
  );

  if (submitResponse.status !== "success") {
    throw new Error(
      submitResponse.message || `Failed to submit application ${email}`
    );
  }

  const approveResponse = await AdmissionService.approveAdmission({
    id: admissionId,
  });

  if (approveResponse.status !== "success") {
    throw new Error(
      approveResponse.message || `Failed to approve application ${email}`
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
  let approvedCreated = 0;
  const failedApplicants: { email: string; error: string }[] = [];

  logger.info("Starting bulk applicant generation", {
    targetCount: args.count,
    modeOfAdmission: "KCET",
    department: args.departmentCode,
    term: "odd 2026",
    semester: "UG 1",
    quota: "CET-AIDED",
    category: "GM",
    porting: args.port,
  });

  for (let attempt = 1; attempt <= args.count; attempt++) {
    const deptCode = args.departmentCode.toLowerCase();
    const email = `mock${attempt}.${deptCode}26@bmsce.ac.in`;
    const password = "password";

    const existing = await db.admission.findUnique({
      where: {
        primaryEmail: email,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      logger.info("Skipping existing applicant", { email });
      continue;
    }

    const existingApplicantUser = await db.user.findFirst({
      where: { email, role: "applicant" },
      select: { id: true },
    });

    try {
      const fullName = `${faker.person.firstName()} ${faker.person.lastName()}`;

      const shellResponse = await AdmissionService.createShell(
        {
          primaryEmail: email,
          password,
          semesterId: context.semesterId,
          departmentId: context.departmentId,
        },
        context.headers
      );

      if (shellResponse.status !== "success") {
        throw new Error(
          shellResponse.message || `Failed to create shell for ${email}`
        );
      }

      const admission = await db.admission.findFirst({
        where: {
          primaryEmail: email,
          semesterId: context.semesterId,
        },
        select: { id: true },
      });

      if (!admission?.id) {
        throw new Error(`Admission id not found for ${email}`);
      }

      logger.info("Resolved admission", {
        email,
        admissionId: admission.id,
      });

      await submitAndApprove(
        email,
        attempt,
        admission.id,
        fullName,
        context.filledById,
        context.departmentId,
        context.semesterId
      );
      approvedCreated += 1;

      if (approvedCreated % 50 === 0 || attempt === args.count) {
        logger.info("Bulk progress", {
          approvedCreated,
          attempt,
          targetCount: args.count,
          latestEmail: email,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("Applicant processing failed", {
        email,
        error: errorMsg,
      });
      failedApplicants.push({ email, error: errorMsg });
      await cleanupPartialApplicant(email, !existingApplicantUser);
    }
  }

  if (failedApplicants.length > 0) {
    logger.error("Applicant failures summary", {
      failedCount: failedApplicants.length,
      failures: failedApplicants.slice(0, 10),
    });
  }

  if (args.port) {
    logger.warn(
      "Porting is semester-wide: all APPROVED admissions in this semester will be ported to students, not only the mock applicants created by this script."
    );

    try {
      const portResponse = await AdmissionService.portStudents(
        { semesterId: context.semesterId },
        context.headers
      );

      logger.info("Port result", {
        data: (portResponse as { data?: unknown }).data,
      });
    } catch (error) {
      logger.error("Failed to port applicants to students", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Bulk applicant script completed", {
    approvedCreated,
    targetCount: args.count,
    status: "APPROVED",
    porting: args.port,
    failedCount: failedApplicants.length,
  });

  if (failedApplicants.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    logger.error("submit-mock-applicant failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
