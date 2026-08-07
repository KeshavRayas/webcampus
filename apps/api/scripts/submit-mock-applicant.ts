import "dotenv/config";
import { faker } from "@faker-js/faker";
import { AdmissionService } from "@webcampus/api/src/services/admission/admission.service";
import { auth } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { config } from "dotenv";

config({ path: "packages/db/.env" });
config({ path: "apps/api/.env" });

const IMAGE_URL =
  "https://adminportal-fileupload.s3.ap-southeast-2.amazonaws.com/department_logo_39bc77d3-dc17-4679-952e-2bab6d716229.jpg";

const PDF_URL =
  "https://adminportal-fileupload.s3.ap-southeast-2.amazonaws.com/aadhar_card_0be79490-379c-4895-ae90-ab574a47b685.pdf";

interface ParsedArgs {
  count: number;
  departmentCode: string;
}

const ensureDefaultDepartments = async () => {
  const existing = await db.department.findMany({
    select: { code: true, name: true },
  });
  const required = [
    { code: "CSE", name: "Computer Science & Engineering" },
    { code: "ECE", name: "Electronics & Communication Engineering" },
    { code: "ISE", name: "Information Science & Engineering" },
    { code: "ME", name: "Mechanical Engineering" },
  ];

  const existingCodes = new Set(existing.map((department) => department.code));
  for (const department of required) {
    if (!existingCodes.has(department.code)) {
      await db.department.create({
        data: {
          code: department.code,
          name: department.name,
          abbreviation: department.code,
          userId:
            (
              await db.user.findFirst({
                where: { role: "admin" },
                select: { id: true },
              })
            )?.id ?? "",
        },
      });
    }
  }
};

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

// const getNextApplicationNumber = async (): Promise<number> => {
//   const rows = await db.admission.findMany({
//     select: { applicationId: true },
//     where: {
//       applicationId: {
//         startsWith: "APP",
//       },
//     },
//     orderBy: {
//       createdAt: "desc",
//     },
//     take: 500,
//   });

//   let maxNumber = 2026000;
//   for (const row of rows) {
//     const parsed = extractNumericId(row.applicationId);
//     if (parsed && parsed > maxNumber) {
//       maxNumber = parsed;
//     }
//   }

//   return maxNumber + 1;
// };

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

  const actor = await db.user.findUnique({
    where: { email: ADMIN_USER_EMAIL },
    select: { id: true },
  });

  if (!actor) {
    throw new Error("Admin user was not found after sign-in");
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

  const fallbackTerm =
    term ??
    (await db.academicTerm.findFirst({
      select: { id: true },
      orderBy: { year: "desc" },
    }));

  if (!fallbackTerm) {
    const createdTerm = await db.academicTerm.create({
      data: { type: "odd", year: "2026", isCurrent: true },
      select: { id: true },
    });
    return {
      headers: { Authorization: `Bearer ${signInResponse.token}` },
      filledById: actor.id,
      departmentId: department.id,
      semesterId: (
        await db.semester.create({
          data: {
            academicTermId: createdTerm.id,
            semesterNumber: 1,
            programType: "UG",
            startDate: new Date("2026-08-01"),
            endDate: new Date("2026-12-31"),
            userId: actor.id,
          },
          select: { id: true },
        })
      ).id,
    };
  }

  const semester = await db.semester.findFirst({
    where: {
      academicTermId: fallbackTerm.id,
      programType: "UG",
      semesterNumber: 1,
    },
    select: { id: true },
  });

  if (!semester) {
    const createdSemester = await db.semester.create({
      data: {
        academicTermId: fallbackTerm.id,
        semesterNumber: 1,
        programType: "UG",
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-12-31"),
        userId: actor.id,
      },
      select: { id: true },
    });
    return {
      headers: { Authorization: `Bearer ${signInResponse.token}` },
      filledById: actor.id,
      departmentId: department.id,
      semesterId: createdSemester.id,
    };
  }

  return {
    headers: { Authorization: `Bearer ${signInResponse.token}` },
    filledById: actor.id,
    departmentId: department.id,
    semesterId: semester.id,
  };
};

const submitAndApprove = async (
  email: string,
  serial: number,
  admissionId: string,
  firstName: string,
  lastName: string,
  filledById: string,
  departmentId: string,
  semesterId: string
): Promise<void> => {
  const fullName = `${firstName} ${lastName}`;

  const data: Record<string, string> = {
    firstName,
    lastName,
    nameAsPer10th: fullName,
    primaryEmail: email,
    semesterId,
    departmentId,
    primaryPhoneNumber: randomPhone(serial),
    aadharNumber: deterministicAadhar(serial),
    admissionType: "REGULAR",
    modeOfAdmission: "KCET",
    categoryClaimed: "GENERAL",
    categoryAllotted: "GENERAL",
    quota: "MERIT",
    scholarship: "false",
    admissionBasedOn: "CLASS_12_PUC",
    hasClass12: "true",
    hasDiploma: "false",
    class10thRollRegNumber: `10TH-${serial}`,
    class12thRollRegNumber: `PUC-${serial}`,
    physicsMarks: "78",
    physicsMaxMarks: "100",
    physicsMinMarks: "35",
    chemistryMarks: "82",
    chemistryMaxMarks: "100",
    chemistryMinMarks: "35",
    mathematicsMarks: "91",
    mathematicsMaxMarks: "100",
    mathematicsMinMarks: "35",
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

  await ensureDefaultDepartments();
  const context = await resolveContext(args.departmentCode);
  // let nextApplicationNumber = await getNextApplicationNumber();
  let approvedCreated = 0;
  let nextSerial = 1;
  let attempts = 0;
  const maxAttempts = Math.max(args.count * 10, 100);

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
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `Stopped after ${maxAttempts} attempts with ${approvedCreated}/${args.count} applicants created`
      );
    }

    const serial = nextSerial++;
    const email = `mock${serial}.${args.departmentCode.toLowerCase()}26@bmsce.ac.in`;
    const password = "password";
    // nextApplicationNumber += 1;

    const existing = await db.admission.findUnique({
      where: {
        primaryEmail: email,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      logger.info("Skipping existing mock applicant", { email });
      continue;
    }

    const existingApplicantUser = await db.user.findFirst({
      where: { email, role: "applicant" },
      select: { id: true },
    });

    try {
      // Generate the names BEFORE creating the shell
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

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

      // createShell returns the applicant user, not the Admission record.
      // Always resolve the admission ID from the database before approving.
      const admissionId = (
        await db.admission.findUnique({
          where: { primaryEmail: email },
          select: { id: true },
        })
      )?.id;

      if (!admissionId) {
        throw new Error(`Admission id not found for ${email}`);
      }

      await submitAndApprove(
        email,
        serial,
        admissionId,
        firstName,
        lastName,
        context.filledById,
        context.departmentId,
        context.semesterId
      );
      approvedCreated += 1;

      if (approvedCreated % 50 === 0 || approvedCreated === args.count) {
        logger.info("Bulk progress", {
          approvedCreated,
          targetCount: args.count,
          latestEmail: email,
        });
      }
    } catch (error) {
      logger.warn("Skipping failed applicant and continuing", {
        email,
        serial,
        attempt: attempts,
        error: error instanceof Error ? error.message : String(error),
      });
      await cleanupPartialApplicant(email, !existingApplicantUser);
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
