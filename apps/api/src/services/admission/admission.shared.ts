import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { $Enums, db, Prisma } from "@webcampus/db";
import { GetAdmissionReportsQueryType } from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";

export const parseOptionalNumber = (
  value: string | undefined
): number | null => {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const calculatePercentage = (
  marks: number | null,
  maxMarks: number | null
): number | null => {
  if (marks === null || maxMarks === null || maxMarks <= 0) return null;
  return Number(((marks / maxMarks) * 100).toFixed(2));
};

export const getStudentFullName = (admission: {
  nameAsPer10th?: string | null;
}): string | null => {
  const fullName = admission.nameAsPer10th?.trim();
  return fullName && fullName.length > 0 ? fullName : null;
};

export const getSortableApplicantName = (admission: {
  nameAsPer10th?: string | null;
}): string => {
  return getStudentFullName(admission)?.toLocaleLowerCase() || "";
};

export const normalizeApplicationId = (value: string): string =>
  value.trim().toLowerCase();

export const applicantEmailFromApplicationId = (
  applicationId: string
): string => `${normalizeApplicationId(applicationId)}@applicant.local`;

export const resolveApplicantUsersForPort = async (
  applicationIds: string[],
  headers: IncomingHttpHeaders
): Promise<{
  userIdByApplicationId: Map<string, string>;
  autoCreatedUsers: number;
}> => {
  const normalizedApplicationIds = Array.from(
    new Set(
      applicationIds
        .map((applicationId) => normalizeApplicationId(applicationId))
        .filter((applicationId) => applicationId.length > 0)
    )
  );

  const userIdByApplicationId = new Map<string, string>();
  if (normalizedApplicationIds.length === 0) {
    return { userIdByApplicationId, autoCreatedUsers: 0 };
  }

  const existingUsers = await db.user.findMany({
    where: {
      OR: [
        ...normalizedApplicationIds.map((applicationId) => ({
          username: {
            equals: applicationId,
            mode: "insensitive" as const,
          },
        })),
        ...normalizedApplicationIds.map((applicationId) => ({
          email: {
            equals: applicationId,
            mode: "insensitive" as const,
          },
        })),
        {
          email: {
            in: normalizedApplicationIds.map((applicationId) =>
              applicantEmailFromApplicationId(applicationId)
            ),
          },
        },
      ],
    },
    select: {
      id: true,
      username: true,
      email: true,
    },
  });

  for (const user of existingUsers) {
    const normalizedUsername = user.username
      ? normalizeApplicationId(user.username)
      : null;
    if (
      normalizedUsername &&
      normalizedApplicationIds.includes(normalizedUsername)
    ) {
      userIdByApplicationId.set(normalizedUsername, user.id);
      continue;
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    if (normalizedApplicationIds.includes(normalizedEmail)) {
      userIdByApplicationId.set(normalizedEmail, user.id);
      continue;
    }

    if (!normalizedEmail.endsWith("@applicant.local")) {
      continue;
    }

    const emailApplicationId = normalizedEmail.replace("@applicant.local", "");
    if (normalizedApplicationIds.includes(emailApplicationId)) {
      userIdByApplicationId.set(emailApplicationId, user.id);
    }
  }

  const missingApplicationIds = normalizedApplicationIds.filter(
    (applicationId) => !userIdByApplicationId.has(applicationId)
  );

  let autoCreatedUsers = 0;

  for (const applicationId of missingApplicationIds) {
    // Porting receives the applicant's primary email, so auto-created users
    // must mirror what `createShell` generates: name "Applicant", email =
    // primary email, username = email local part.
    const normalizedUsername = applicationId.split("@")[0] ?? "";
    const userService = new UserService({
      request: {
        email: applicationId,
        name: "Applicant",
        username: normalizedUsername,
        password: "password",
        role: "applicant",
      },
      headers,
    });

    try {
      const createResponse = await userService.create();
      if (createResponse.status === "success" && createResponse.data?.id) {
        userIdByApplicationId.set(applicationId, createResponse.data.id);
        autoCreatedUsers += 1;
        continue;
      }
    } catch {
      // If create fails due to race/uniqueness, try a fresh lookup before failing.
    }

    const fallbackUser = await db.user.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: applicationId,
              mode: "insensitive",
            },
          },
          {
            username: {
              equals: normalizedUsername,
              mode: "insensitive",
            },
          },
          {
            email: {
              equals: applicationId,
              mode: "insensitive",
            },
          },
          {
            email: {
              equals: applicantEmailFromApplicationId(applicationId),
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (fallbackUser?.id) {
      userIdByApplicationId.set(applicationId, fallbackUser.id);
      continue;
    }
  }

  const unresolvedApplicationIds = normalizedApplicationIds.filter(
    (applicationId) => !userIdByApplicationId.has(applicationId)
  );

  if (unresolvedApplicationIds.length > 0) {
    throw new Error(
      `Unable to resolve applicant user(s) for application ID(s): ${unresolvedApplicationIds
        .map((applicationId) => applicationId.toUpperCase())
        .join(", ")}`
    );
  }

  return {
    userIdByApplicationId,
    autoCreatedUsers,
  };
};

export const updateAdmissionStatus = async (
  id: string,
  status: "APPROVED" | "REJECTED"
): Promise<BaseResponse<unknown>> => {
  const admission = await db.admission.findUnique({
    where: { id },
  });

  if (!admission) {
    throw new Error("Admission not found");
  }

  if (admission.status !== "SUBMITTED") {
    throw new Error(
      `Only SUBMITTED applications can be marked ${status}. Current status is ${admission.status}`
    );
  }

  const updatedAdmission = await db.admission.update({
    where: { id },
    data: {
      status,
      ...(status === "APPROVED" ? { feeStatus: true } : {}),
    },
    include: { semester: true },
  });

  return {
    status: "success",
    message: `Admission ${status.toLowerCase()} successfully`,
    data: updatedAdmission,
  };
};

export const buildAdmissionWhere = (
  filters: GetAdmissionReportsQueryType,
  filledById?: string
): Prisma.AdmissionWhereInput => {
  const createdTo = filters.createdTo ? new Date(filters.createdTo) : undefined;

  if (createdTo) {
    createdTo.setHours(23, 59, 59, 999);
  }

  const splitValues = (value?: string): string[] =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const VALID_STATUSES = [
    "PENDING",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
    "EXITED",
    "CANCELLED",
    "PORTED",
  ];
  const VALID_ADMISSION_TYPES = ["REGULAR", "LATERAL_ENTRY", "COLLEGE_CHANGE"];

  const statusValues = splitValues(filters.status).filter((status) =>
    VALID_STATUSES.includes(status)
  );
  const admissionTypeValues = splitValues(filters.admissionType).filter(
    (type) => VALID_ADMISSION_TYPES.includes(type)
  );

  let statusIn: string[] | undefined = statusValues.length
    ? statusValues
    : undefined;
  let statusNotIn: string[] | undefined;

  const cancellationStatusValues = splitValues(filters.cancellationStatus);
  if (cancellationStatusValues.length) {
    const wantsCancelled = cancellationStatusValues.includes("CANCELLED");
    const wantsActive = cancellationStatusValues.includes("ACTIVE");
    if (wantsCancelled && !wantsActive) {
      statusIn = statusIn
        ? statusIn.filter((status) => status === "CANCELLED")
        : ["CANCELLED"];
    } else if (wantsActive && !wantsCancelled) {
      statusIn = statusIn
        ? statusIn.filter((status) => status !== "CANCELLED")
        : undefined;
      statusNotIn = ["CANCELLED"];
    }
  }

  const feeStatusValues = splitValues(filters.feeStatus);
  const wantsPaid = feeStatusValues.includes("true");
  const wantsUnpaid = feeStatusValues.includes("false");

  const cancellationReasons = splitValues(filters.cancellationReason);
  const hasOtherReason = cancellationReasons.includes("OTHER");
  const directReasons = cancellationReasons.filter(
    (reason) => reason !== "OTHER"
  );

  const hostelValues = splitValues(filters.hostel);
  const search = filters.search?.trim();

  return {
    filledById,
    applicationId: filters.applicationId
      ? {
          contains: filters.applicationId,
          mode: "insensitive",
        }
      : undefined,
    status: statusIn
      ? { in: statusIn as $Enums.AdmissionStatus[] }
      : statusNotIn
        ? { notIn: statusNotIn as $Enums.AdmissionStatus[] }
        : undefined,
    feeStatus:
      feeStatusValues.length && wantsPaid !== wantsUnpaid
        ? wantsPaid
        : undefined,
    modeOfAdmission: filters.mode
      ? { in: splitValues(filters.mode) }
      : undefined,
    admissionType: admissionTypeValues.length
      ? { in: admissionTypeValues }
      : undefined,
    admissionBasedOn: filters.admissionBasedOn
      ? { in: splitValues(filters.admissionBasedOn) }
      : undefined,
    departmentId: filters.department
      ? { in: splitValues(filters.department) }
      : undefined,
    categoryClaimed: filters.categoryClaimed
      ? { in: splitValues(filters.categoryClaimed) }
      : undefined,
    categoryAllotted: filters.categoryAllotted
      ? { in: splitValues(filters.categoryAllotted) }
      : undefined,
    quota: filters.quota ? { in: splitValues(filters.quota) } : undefined,
    counsellingRound: filters.round
      ? { in: splitValues(filters.round) }
      : undefined,
    hostel: hostelValues.length === 1 ? hostelValues[0] === "true" : undefined,
    cancellation: cancellationReasons.length
      ? {
          is: {
            OR: [
              ...(directReasons.length
                ? [{ reason: { in: directReasons } }]
                : []),
              ...(hasOtherReason ? [{ reason: { startsWith: "OTHER:" } }] : []),
            ],
          },
        }
      : undefined,
    semesterId: filters.semester,
    createdAt:
      filters.createdFrom || createdTo
        ? {
            gte: filters.createdFrom
              ? new Date(filters.createdFrom)
              : undefined,
            lte: createdTo,
          }
        : undefined,
    ...(search
      ? {
          OR: [
            { primaryEmail: { contains: search, mode: "insensitive" } },
            {
              student: {
                is: {
                  user: { name: { contains: search, mode: "insensitive" } },
                },
              },
            },
          ],
        }
      : {}),
  };
};

export const generateTempUsnWithClient = async (
  client: Pick<Prisma.TransactionClient, "semester" | "admission">,
  semesterId: string,
  branchCode: string
): Promise<string> => {
  try {
    const semester = await client.semester.findUnique({
      where: { id: semesterId },
      include: { academicTerm: true },
    });
    if (!semester) throw new Error("Semester not found");

    const yearPrefix = semester.academicTerm.year.toString().slice(-2);
    const formattedBranch = branchCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 4);
    const prefix = `TBM${yearPrefix}${formattedBranch}`;

    const lastAdmission = await client.admission.findFirst({
      where: { tempUsn: { startsWith: prefix } },
      orderBy: { tempUsn: "desc" },
    });

    if (!lastAdmission || !lastAdmission.tempUsn) return `${prefix}0001`;

    const lastNumberStr = lastAdmission.tempUsn.slice(-4);
    const lastNumber = parseInt(lastNumberStr, 10);

    if (isNaN(lastNumber)) return `${prefix}0001`;

    const nextNumber = lastNumber + 1;

    return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
  } catch (error) {
    logger.error("Failed to generate temp USN", error);
    throw new Error("Failed to generate temp USN");
  }
};

export const ensureApplicantUser = async (
  email: string,
  headers: IncomingHttpHeaders,
  preferredName?: string
): Promise<{ id: string }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const applicantName = preferredName?.trim() || "Applicant";

  const existingUser = await db.user.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, name: true, role: true },
  });

  if (existingUser?.id) {
    if (
      existingUser.role === "applicant" &&
      preferredName?.trim() &&
      existingUser.name !== preferredName.trim()
    ) {
      await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: applicantName,
          displayUsername: applicantName,
        },
      });
    }

    return existingUser;
  }

  const userService = new UserService({
    request: {
      email: normalizedEmail,
      name: applicantName,
      username: (normalizedEmail.split("@")[0] ?? "").trim().toLowerCase(),
      password: "password",
      role: "applicant",
    },
    headers,
  });

  const createResponse = await userService.create();

  if (createResponse.status === "error" || !createResponse.data?.id) {
    throw new Error(
      createResponse.message || "Failed to create applicant account"
    );
  }

  return { id: createResponse.data.id };
};

export const getSessionUserId = async (
  headers: IncomingHttpHeaders
): Promise<string | undefined> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
  return session?.user?.id;
};

export const getFilledByIdForRole = async (
  headers: IncomingHttpHeaders
): Promise<string | undefined> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
  return session?.user?.role === "admission-instructor"
    ? session.user.id
    : undefined;
};
