import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AdmissionActionParamType,
  CreateAdmissionShellType,
  GetAdmissionsQueryType,
  PortStudentsType,
} from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";

export class AdmissionService {
  private static getStudentFullName(admission: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
  }): string | null {
    const fullName = [
      admission.firstName?.trim(),
      admission.middleName?.trim(),
      admission.lastName?.trim(),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .trim();

    return fullName.length > 0 ? fullName : null;
  }

  private static getSortableApplicantName(admission: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
  }): string {
    return (
      AdmissionService.getStudentFullName(admission)?.toLocaleLowerCase() || ""
    );
  }

  private static normalizeApplicationId(value: string): string {
    return value.trim().toLowerCase();
  }

  private static applicantEmailFromApplicationId(
    applicationId: string
  ): string {
    return `${AdmissionService.normalizeApplicationId(applicationId)}@applicant.local`;
  }

  private static async resolveApplicantUsersForPort(
    applicationIds: string[],
    headers: IncomingHttpHeaders
  ): Promise<{
    userIdByApplicationId: Map<string, string>;
    autoCreatedUsers: number;
  }> {
    const normalizedApplicationIds = Array.from(
      new Set(
        applicationIds
          .map((applicationId) =>
            AdmissionService.normalizeApplicationId(applicationId)
          )
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
          {
            email: {
              in: normalizedApplicationIds.map((applicationId) =>
                AdmissionService.applicantEmailFromApplicationId(applicationId)
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
        ? AdmissionService.normalizeApplicationId(user.username)
        : null;
      if (
        normalizedUsername &&
        normalizedApplicationIds.includes(normalizedUsername)
      ) {
        userIdByApplicationId.set(normalizedUsername, user.id);
        continue;
      }

      const normalizedEmail = user.email.trim().toLowerCase();
      if (!normalizedEmail.endsWith("@applicant.local")) {
        continue;
      }

      const emailApplicationId = normalizedEmail.replace(
        "@applicant.local",
        ""
      );
      if (normalizedApplicationIds.includes(emailApplicationId)) {
        userIdByApplicationId.set(emailApplicationId, user.id);
      }
    }

    const missingApplicationIds = normalizedApplicationIds.filter(
      (applicationId) => !userIdByApplicationId.has(applicationId)
    );

    let autoCreatedUsers = 0;

    for (const applicationId of missingApplicationIds) {
      // Username is normalized to lowercase for Better Auth credential lookup compatibility.
      const normalizedUsername = AdmissionService.normalizeApplicationId(applicationId);
      const userService = new UserService({
        request: {
          email:
            AdmissionService.applicantEmailFromApplicationId(applicationId),
          name: `Applicant ${applicationId.toUpperCase()}`,
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
              email:
                AdmissionService.applicantEmailFromApplicationId(applicationId),
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
  }

  private static async updateAdmissionStatus(
    id: string,
    status: "APPROVED" | "REJECTED"
  ): Promise<BaseResponse<unknown>> {
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
      data: { status },
      include: { semester: true },
    });

    return {
      status: "success",
      message: `Admission ${status.toLowerCase()} successfully`,
      data: updatedAdmission,
    };
  }

  static async createShell(
    data: CreateAdmissionShellType,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      const applicationId = data.applicationId.trim();
      const applicantEmail = `${applicationId.toLowerCase()}@applicant.local`;

      // Guard against duplicate admission shells first.
      const existingAdmission = await db.admission.findFirst({
        where: {
          applicationId: {
            equals: applicationId,
            mode: "insensitive",
          },
        },
      });

      if (existingAdmission) {
        throw new Error("An admission with this Application ID already exists");
      }

      // Ensure an applicant auth user exists for this application ID.
      // Reuse it if it already exists (for idempotent retries).
      const existingApplicantUser = await db.user.findFirst({
        where: {
          OR: [
            {
              username: {
                equals: applicationId,
                mode: "insensitive",
              },
            },
            { email: applicantEmail },
          ],
        },
        select: {
          id: true,
          role: true,
        },
      });

      let createdNewApplicantUser = false;

      if (existingApplicantUser && existingApplicantUser.role !== "applicant") {
        throw new Error(
          "This Application ID is already linked to a non-applicant user"
        );
      }

      if (!existingApplicantUser) {
        // We generate a dummy email and name since the applicant has not filled it out yet.
        // Username is normalized to lowercase for Better Auth compatibility.
        const userService = new UserService({
          request: {
            email: applicantEmail,
            name: `Applicant ${applicationId}`,
            username: AdmissionService.normalizeApplicationId(applicationId),
            password: "password", // Dummy password
            role: "applicant",
          },
          headers,
        });

        const authUser = await userService.create();

        if (authUser.status === "error" || !authUser.data?.id) {
          throw new Error(
            authUser.message || "Failed to create applicant user account"
          );
        }

        createdNewApplicantUser = true;
      }

      // 3. Create the Admission Shell in the database.
      const admission = await db.admission.create({
        data: {
          applicationId,
          modeOfAdmission: data.modeOfAdmission,
          semesterId: data.semesterId,
          departmentId: data.departmentId,
          categoryClaimed: data.categoryClaimed,
          categoryAllotted: data.categoryAllotted,
          quota: data.quota,
          status: "PENDING", // Explicitly setting the initial status
        },
        include: {
          semester: true,
        },
      });

      const response: BaseResponse<unknown> = {
        status: "success",
        message: createdNewApplicantUser
          ? "Admission shell and applicant account created successfully"
          : "Admission shell created successfully",
        data: admission,
      };

      logger.info(response);
      return response;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("An admission with this Application ID already exists");
      }
      logger.error("Failed to create admission shell", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create admission shell"
      );
    }
  }

  static async getAdmissions(
    filters: GetAdmissionsQueryType
  ): Promise<BaseResponse<unknown>> {
    try {
      const createdTo = filters.createdTo
        ? new Date(filters.createdTo)
        : undefined;

      if (createdTo) {
        createdTo.setHours(23, 59, 59, 999);
      }

      const admissions = await db.admission.findMany({
        where: {
          applicationId: filters.applicationId
            ? {
                contains: filters.applicationId,
                mode: "insensitive",
              }
            : undefined,
          status: filters.status,
          modeOfAdmission: filters.mode
            ? {
                equals: filters.mode,
                mode: "insensitive",
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
        },
        orderBy: { createdAt: "desc" },
        include: {
          semester: true,
          department: true,
          student: {
            select: {
              usn: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      return {
        status: "success",
        message: "Admissions fetched successfully",
        data: admissions,
      };
    } catch (error) {
      logger.error("Failed to fetch admissions", error);
      throw error;
    }
  }

  static async getAdmissionsBySemester(
    semesterId: string
  ): Promise<BaseResponse<unknown>> {
    return this.getAdmissions({ semester: semesterId });
  }

  static async getByApplicationId(
    applicationId: string
  ): Promise<BaseResponse<unknown>> {
    const admission = await db.admission.findFirst({
      where: {
        applicationId: {
          equals: applicationId,
          mode: "insensitive",
        },
      },
      include: {
        semester: true,
        department: true,
        student: {
          select: {
            usn: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    return { status: "success", message: "Fetched", data: admission };
  }

  static async deleteAdmission(id: string): Promise<BaseResponse<unknown>> {
    try {
      // Fetch the admission record
      const admission = await db.admission.findUnique({ where: { id } });
      if (!admission) throw new Error("Admission not found");

      // Delete associated S3 files if they exist
      const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
      const fileUrls = [
        admission.photo,
        admission.class10thMarksPdf,
        admission.class12thMarksPdf,
        admission.casteCertificate,
        admission.disabilityCertificate,
        admission.economicallyBackwardCertificate,
        admission.aadharCard,
        admission.transferCertificate,
        admission.studyCertificate,
      ].filter(
        (url): url is string => typeof url === "string" && url.length > 0
      );

      await Promise.all(fileUrls.map((url) => deleteFromS3(url)));

      const applicationId = admission.applicationId;
      const applicantEmail = `${applicationId.toLowerCase()}@applicant.local`;

      // Delete the database record
      const applicantUser = await db.user.findFirst({
        where: {
          OR: [
            { username: { equals: applicationId, mode: "insensitive" } },
            { email: applicantEmail },
          ],
          role: "applicant", // Safety check: Ensure we only delete if they are still an 'applicant'
        },
        select: { id: true },
      });

      // --- NEW LOGIC: Delete both inside a transaction ---
      await db.$transaction(async (tx) => {
        // 1. Delete the admission record
        await tx.admission.delete({ where: { id } });

        // 2. Delete the user account (if found)
        if (applicantUser) {
          await tx.user.delete({ where: { id: applicantUser.id } });
        }
      });

      return {
        status: "success",
        message: "Admission deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Failed to delete admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to delete admission"
      );
    }
  }

  private static async generateTempUsnWithClient(
    client: Pick<Prisma.TransactionClient, "semester" | "admission">,
    semesterId: string,
    branchCode: string
  ): Promise<string> {
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
      logger.error("Failed to generate Temp USN", error);
      throw new Error("Failed to generate Temp USN");
    }
  }

  static async generateTempUsn(
    semesterId: string,
    branchCode: string
  ): Promise<string> {
    return AdmissionService.generateTempUsnWithClient(
      db,
      semesterId,
      branchCode
    );
  }

  static async submitApplication(
    applicationId: string,
    data: Record<string, string>, // Text fields
    fileUrls: { [key: string]: string } // S3 URLs
  ): Promise<BaseResponse<unknown>> {
    try {
      // Log the incoming applicationId for debugging
      logger.info("submitApplication called", {
        applicationId,
        receivedFields: Object.keys(data),
      });

      // Find the existing shell case-insensitively
      const existingAdmission = await db.admission.findFirst({
        where: {
          applicationId: {
            equals: applicationId,
            mode: "insensitive",
          },
        },
      });

      if (!existingAdmission) {
        logger.error("Admission shell not found", {
          applicationId,
          searchMode: "case-insensitive",
        });
        throw new Error(
          `Admission shell not found for application ID: ${applicationId}. Please ensure the admin created the admission shell.`
        );
      }

      logger.info("Admission shell found", {
        id: existingAdmission.id,
        applicationId: existingAdmission.applicationId,
        departmentId: existingAdmission.departmentId,
      });

      // Department is already strictly locked to the shell
      const department = await db.department.findUnique({
        where: { id: existingAdmission.departmentId },
      });

      if (!department) {
        logger.error("Department not found", {
          departmentId: existingAdmission.departmentId,
        });
        throw new Error(
          `Assigned department does not exist (ID: ${existingAdmission.departmentId}).`
        );
      }

      logger.info("Department found", { name: department.name });

      // Validate aadharNumber uniqueness: allow if same record or if aadhar doesn't exist elsewhere
      if (data.aadharNumber && data.aadharNumber !== existingAdmission.aadharNumber) {
        const existingAadhar = await db.admission.findUnique({
          where: { aadharNumber: data.aadharNumber },
        });
        if (existingAadhar && existingAadhar.id !== existingAdmission.id) {
          logger.error("Aadhar number already in use by different applicant", {
            aadharNumber: data.aadharNumber,
            existingAdmissionId: existingAadhar.id,
            currentAdmissionId: existingAdmission.id,
          });
          throw new Error(
            `Aadhar number ${data.aadharNumber} is already registered with another applicant. Please verify and submit again.`
          );
        }
      }

      // Update the record using its exact unique database ID
      const updatedAdmission = await db.admission.update({
        where: { id: existingAdmission.id }, // Update by ID instead of applicationId
        data: {
          status: "SUBMITTED",

          // Admission Details
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          // Quota, Category, and Department are preserved securely from initial shell creation
          entranceExamRank: data.entranceExamRank,
          originalAdmissionOrderNumber: data.originalAdmissionOrderNumber,
          originalAdmissionOrderDate: data.originalAdmissionOrderDate
            ? new Date(data.originalAdmissionOrderDate)
            : null,
          feePayable: data.feePayable ? parseFloat(data.feePayable) : null,
          feePaid: data.feePaid ? parseFloat(data.feePaid) : null,
          hostel: data.hostel === "true",
          hostelRoomNumber: data.hostelRoomNumber ?? null,

          // Personal Information
          nameAsPer10th: data.nameAsPer10th,
          dob: data.dob ? new Date(data.dob) : null,
          bloodGroup: data.bloodGroup,
          gender: data.gender,
          primaryPhoneNumber: data.primaryPhoneNumber,
          secondaryPhoneNumber: data.secondaryPhoneNumber,
          emergencyContactNumber: data.emergencyContactNumber,
          primaryEmail: data.primaryEmail,
          secondaryEmail: data.secondaryEmail,

          currentAddress: data.currentAddress,
          currentCity: data.currentCity,
          currentArea: data.currentArea,
          currentDistrict: data.currentDistrict,
          currentState: data.currentState,
          currentCountry: data.currentCountry,
          currentPincode: data.currentPincode,

          permanentAddress: data.permanentAddress,
          permanentCity: data.permanentCity,
          permanentArea: data.permanentArea,
          permanentDistrict: data.permanentDistrict,
          permanentState: data.permanentState,
          permanentCountry: data.permanentCountry,
          permanentPincode: data.permanentPincode,

          placeOfBirth: data.placeOfBirth,
          stateOfBirth: data.stateOfBirth,
          religion: data.religion,
          caste: data.caste,
          subCaste: data.subCaste ?? null,
          motherTongue: data.motherTongue,
          nri: data.nri === "true",
          nationality: data.nationality,
          disability: data.disability === "true",
          disabilityType: data.disabilityType ?? null,
          economicallyBackward: data.economicallyBackward === "true",
          aadharNumber: data.aadharNumber,

          // Education Details
          class10thSchoolName: data.class10thSchoolName,
          class10thSchoolType: data.class10thSchoolType,
          class10thSchoolCity: data.class10thSchoolCity,
          class10thSchoolState: data.class10thSchoolState,
          class10thSchoolCode: data.class10thSchoolCode,
          class10thYearOfPassing: data.class10thYearOfPassing,
          class10thAggregateScore: data.class10thAggregateScore
            ? parseFloat(data.class10thAggregateScore)
            : null,
          class10thAggregateTotal: data.class10thAggregateTotal
            ? parseFloat(data.class10thAggregateTotal)
            : null,
          class10thMediumOfTeaching: data.class10thMediumOfTeaching,

          class12thInstituteName: data.class12thInstituteName,
          class12thInstituteType: data.class12thInstituteType,
          class12thInstituteCity: data.class12thInstituteCity,
          class12thInstituteState: data.class12thInstituteState,
          class12thInstituteCode: data.class12thInstituteCode,
          class12thYearOfPassing: data.class12thYearOfPassing,
          class12thBranch: data.class12thBranch,
          class12thAggregateScore: data.class12thAggregateScore
            ? parseFloat(data.class12thAggregateScore)
            : null,
          class12thAggregateTotal: data.class12thAggregateTotal
            ? parseFloat(data.class12thAggregateTotal)
            : null,
          class12thMediumOfTeaching: data.class12thMediumOfTeaching,

          // Parent Details
          fatherName: data.fatherName,
          fatherEmail: data.fatherEmail,
          fatherNumber: data.fatherNumber,
          fatherPermanentAddress: data.fatherPermanentAddress,
          fatherOccupation: data.fatherOccupation ?? null,

          motherName: data.motherName,
          motherEmail: data.motherEmail,
          motherNumber: data.motherNumber,
          motherPermanentAddress: data.motherPermanentAddress,
          motherOccupation: data.motherOccupation ?? null,

          guardianName: data.guardianName ?? null,
          guardianEmail: data.guardianEmail ?? null,
          guardianNumber: data.guardianNumber ?? null,
          guardianPermanentAddress: data.guardianPermanentAddress ?? null,
          guardianOccupation: data.guardianOccupation ?? null,

          // Inject the S3 URLs if they were successfully uploaded
          ...(fileUrls.class10thMarksPdf && {
            class10thMarksPdf: fileUrls.class10thMarksPdf,
          }),
          ...(fileUrls.class12thMarksPdf && {
            class12thMarksPdf: fileUrls.class12thMarksPdf,
          }),
          ...(fileUrls.casteCertificate && {
            casteCertificate: fileUrls.casteCertificate,
          }),
          ...(fileUrls.photo && {
            photo: fileUrls.photo,
          }),
          ...(fileUrls.disabilityCertificate && {
            disabilityCertificate: fileUrls.disabilityCertificate,
          }),
          ...(fileUrls.economicallyBackwardCertificate && {
            economicallyBackwardCertificate:
              fileUrls.economicallyBackwardCertificate,
          }),
          ...(fileUrls.aadharCard && {
            aadharCard: fileUrls.aadharCard,
          }),
          ...(fileUrls.transferCertificate && {
            transferCertificate: fileUrls.transferCertificate,
          }),
          ...(fileUrls.studyCertificate && {
            studyCertificate: fileUrls.studyCertificate,
          }),
        },
      });

      return {
        status: "success",
        message: "Application submitted successfully",
        data: updatedAdmission,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to submit application", {
        applicationId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        errorMessage || "Failed to submit application. Please contact support."
      );
    }
  }

  static async approveAdmission(
    params: AdmissionActionParamType
  ): Promise<BaseResponse<unknown>> {
    try {
      return await AdmissionService.updateAdmissionStatus(
        params.id,
        "APPROVED"
      );
    } catch (error) {
      logger.error("Failed to approve admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to approve admission"
      );
    }
  }

  static async rejectAdmission(
    params: AdmissionActionParamType
  ): Promise<BaseResponse<unknown>> {
    try {
      return await AdmissionService.updateAdmissionStatus(
        params.id,
        "REJECTED"
      );
    } catch (error) {
      logger.error("Failed to reject admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to reject admission"
      );
    }
  }

  static async portStudents(
    payload: PortStudentsType,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      const [semester, unresolvedCount, approvedAdmissions] = await Promise.all(
        [
          db.semester.findUnique({
            where: { id: payload.semesterId },
            select: {
              id: true,
              academicTerm: { select: { year: true } },
              semesterNumber: true,
            },
          }),
          db.admission.count({
            where: {
              semesterId: payload.semesterId,
              status: {
                in: ["PENDING", "SUBMITTED"],
              },
            },
          }),
          db.admission.findMany({
            where: {
              semesterId: payload.semesterId,
              status: "APPROVED",
            },
            orderBy: [{ applicationId: "asc" }],
            select: {
              id: true,
              applicationId: true,
              departmentId: true,
              tempUsn: true,
              studentId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              primaryEmail: true,
              photo: true,
            },
          }),
        ]
      );

      if (!semester) {
        throw new Error("Semester not found");
      }

      if (unresolvedCount > 0) {
        throw new Error(
          `Cannot port students. ${unresolvedCount} application(s) are still pending review.`
        );
      }

      const approvedUnportedAdmissions = approvedAdmissions.filter(
        (admission) => !admission.studentId
      );

      approvedUnportedAdmissions.sort((left, right) => {
        const leftName = AdmissionService.getSortableApplicantName(left);
        const rightName = AdmissionService.getSortableApplicantName(right);

        if (leftName !== rightName) {
          return leftName.localeCompare(rightName);
        }

        return left.applicationId.localeCompare(right.applicationId);
      });

      const allApprovedApplicationIds = approvedAdmissions.map(
        (admission) => admission.applicationId
      );

      const { userIdByApplicationId, autoCreatedUsers } =
        await AdmissionService.resolveApplicantUsersForPort(
          allApprovedApplicationIds,
          headers
        );

      let newlyPorted = 0;
      let alreadyPorted = 0;
      const failedPorts: { applicationId: string; reason: string }[] = [];

      for (const admission of approvedUnportedAdmissions) {
        try {
          const userId = userIdByApplicationId.get(
            AdmissionService.normalizeApplicationId(admission.applicationId)
          );
          if (!userId) {
            throw new Error(
              `Applicant user not found for application ID ${admission.applicationId}`
            );
          }

          if (!admission.departmentId) {
            throw new Error(
              `Branch is missing for application ID ${admission.applicationId}`
            );
          }

          await db.$transaction(async (tx) => {
            const department = await tx.department.findUnique({
              where: { id: admission.departmentId },
              select: { name: true, code: true },
            });

            if (!department) {
              throw new Error(
                `Department not found for application ID ${admission.applicationId}`
              );
            }

            let finalUsn = admission.tempUsn?.trim();
            if (!finalUsn) {
              // Legacy/generated admissions may skip submit flow; backfill temp USN here.
              finalUsn = await AdmissionService.generateTempUsnWithClient(
                tx,
                payload.semesterId,
                department.code
              );
            }

            const fullName = AdmissionService.getStudentFullName(admission);
            const primaryEmail = admission.primaryEmail?.trim().toLowerCase();

            if (!fullName) {
              throw new Error(
                `Cannot port ${admission.applicationId}: student full name is missing`
              );
            }

            if (!primaryEmail) {
              throw new Error(
                `Cannot port ${admission.applicationId}: student primary email is missing`
              );
            }

            const existingEmailOwner = await tx.user.findFirst({
              where: {
                email: primaryEmail,
                id: { not: userId },
              },
              select: { id: true },
            });

            if (existingEmailOwner) {
              throw new Error(
                `Cannot port ${admission.applicationId}: email ${primaryEmail} is already used by another user`
              );
            }

            const existingStudent = await tx.student.findFirst({
              where: {
                OR: [{ userId }, { usn: finalUsn }],
              },
              select: {
                id: true,
                usn: true,
              },
            });

            const finalStudentUsn = existingStudent?.usn ?? finalUsn;

            if (existingStudent) {
              await tx.admission.update({
                where: { id: admission.id },
                data: {
                  tempUsn: finalStudentUsn,
                  studentId: existingStudent.id,
                },
              });

              await tx.user.update({
                where: { id: userId },
                data: {
                  role: "student",
                  name: fullName,
                  displayUsername: fullName,
                  username: finalStudentUsn,
                  email: primaryEmail,
                  image: admission.photo ?? undefined,
                },
              });

              alreadyPorted += 1;
              return;
            }

            const createdStudent = await tx.student.create({
              data: {
                userId,
                usn: finalStudentUsn,
                departmentName: department.name,
                currentSemester: semester.semesterNumber,
                academicYear: semester.academicTerm.year,
              },
              select: {
                id: true,
              },
            });

            await tx.admission.update({
              where: { id: admission.id },
              data: {
                tempUsn: finalStudentUsn,
                studentId: createdStudent.id,
              },
            });

            await tx.user.update({
              where: { id: userId },
              data: {
                role: "student",
                name: fullName,
                displayUsername: fullName,
                username: finalStudentUsn,
                email: primaryEmail,
                image: admission.photo ?? undefined,
              },
            });

            newlyPorted += 1;
          });
        } catch (studentError) {
          const reason =
            studentError instanceof Error
              ? studentError.message
              : "Failed to port student";
          failedPorts.push({
            applicationId: admission.applicationId,
            reason,
          });
        }
      }

      return {
        status: "success",
        message:
          failedPorts.length > 0
            ? "Students ported with partial failures"
            : "Students ported successfully",
        data: {
          semesterId: payload.semesterId,
          semesterNumber: semester.semesterNumber,
          totalApproved: approvedAdmissions.length,
          newlyPorted,
          alreadyPorted,
          failedPorts,
          autoCreatedApplicants: autoCreatedUsers,
          rejectedCount: await db.admission.count({
            where: {
              semesterId: payload.semesterId,
              status: "REJECTED",
            },
          }),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Port operation encountered duplicate student data");
        }

        if (error.code === "P2003") {
          throw new Error(
            "Port operation failed due to missing department mapping for one or more branches"
          );
        }
      }

      logger.error("Failed to port students", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to port students"
      );
    }
  }
}

