import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AdmissionActionParamType,
  ChangeAdmissionModeType,
  CreateAdmissionShellType,
  GetAdmissionsQueryType,
  PortStudentsType,
} from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";
import {
  buildStudentEmailAddress,
  getStudentEmailYearSuffix,
  normalizeStudentEmailToken,
} from "./student-email";

const parseOptionalNumber = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculatePercentage = (
  marks: number | null,
  maxMarks: number | null
): number | null => {
  if (marks === null || maxMarks === null || maxMarks <= 0) return null;
  return Number(((marks / maxMarks) * 100).toFixed(2));
};

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
      const normalizedUsername =
        AdmissionService.normalizeApplicationId(applicationId);
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
      const applicantEmail = data.primaryEmail.trim().toLowerCase();

      const existingApplicantUser = await db.user.findFirst({
        where: {
          email: applicantEmail,
        },
        select: {
          id: true,
        },
      });

      if (existingApplicantUser) {
        throw new Error("An account with this email already exists");
      }

      const departmentCode = applicantEmail
        .split("@")[0]
        ?.match(/\.([a-z]+)\d{2,4}$/i)?.[1];

      if (!departmentCode) {
        throw new Error(
          "Applicant email must follow the name.departmentCodeYear format"
        );
      }

      const department = await db.department.findFirst({
        where: {
          code: {
            equals: departmentCode,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (!department) {
        throw new Error(`Department code ${departmentCode} was not found`);
      }

      if (department.id !== data.departmentId) {
        throw new Error("The selected department does not match the email");
      }

      const userService = new UserService({
        request: {
          email: applicantEmail,
          name: "Applicant",
          username: applicantEmail,
          password: data.password,
          role: "applicant",
        },
        headers,
      });

      const authUser = await userService.create();

      if (authUser.status === "error" || !authUser.data?.id) {
        throw new Error(
          authUser.message || "Failed to create applicant account"
        );
      }

      await db.admission.create({
        data: {
          // applicationId: crypto.randomUUID(), // or primaryEmail for now
          primaryEmail: data.primaryEmail,

          semesterId: data.semesterId,
          departmentId: department.id,

          status: "PENDING",
        },
      });

      return {
        status: "success",
        message: "Applicant account created successfully",
        data: authUser.data,
      };
    } catch (error) {
      logger.error("Failed to create applicant account", error);

      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create applicant account"
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
          admissionType: filters.admissionType
            ? {
                equals: filters.admissionType,
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
        admission.diplomaMarksPdf,
        admission.casteCertificate,
        admission.disabilityCertificate,
        admission.economicallyBackwardCertificate,
        admission.aadharCard,
        admission.transferCertificate,
        admission.studyCertificate,
        admission.embassyPermissionLetter,
      ].filter(
        (url): url is string => typeof url === "string" && url.length > 0
      );

      await Promise.all(fileUrls.map((url) => deleteFromS3(url)));
      const applicantEmail = admission.primaryEmail?.trim().toLowerCase();

      // Delete the database record
      const applicantUser = await db.user.findFirst({
        where: {
          OR: [{ email: applicantEmail, role: "applicant" }],
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
    primaryEmail: string,
    data: Record<string, string>,
    fileUrls: { [key: string]: string }
  ): Promise<BaseResponse<unknown>> {
    try {
      logger.info("submitApplication called", {
        primaryEmail,
        receivedFields: Object.keys(data),
      });
      logger.info({
        primaryEmail,
      });

      const admission = await db.admission.findUnique({
        where: {
          primaryEmail,
        },
        include: {
          semester: true,
        },
      });

      if (!admission) {
        throw new Error("Admission application not found.");
      }

      if (admission.status === "SUBMITTED") {
        throw new Error("Application has already been submitted.");
      }

      if (!data.admissionType) {
        throw new Error("Admission type is required.");
      }

      const validAdmissionTypes =
        admission.semester.semesterNumber === 1
          ? ["REGULAR"]
          : admission.semester.semesterNumber === 3
            ? ["LATERAL_ENTRY", "COLLEGE_CHANGE"]
            : [];

      if (!validAdmissionTypes.includes(data.admissionType)) {
        throw new Error(
          `Admission type ${data.admissionType} is not valid for semester ${admission.semester.semesterNumber}.`
        );
      }

      if (data.semesterId && data.semesterId !== admission.semesterId) {
        throw new Error("The submitted semester does not match the admission.");
      }

      if (data.scholarship !== "true" && data.scholarship !== "false") {
        throw new Error("Scholarship selection is required.");
      }

      if (data.scholarship === "true" && !data.sspId?.trim()) {
        throw new Error("SSP ID is required when scholarship is enabled.");
      }

      const physicsMarks = parseOptionalNumber(data.physicsMarks);
      const physicsMaxMarks = parseOptionalNumber(data.physicsMaxMarks);
      const chemistryMarks = parseOptionalNumber(data.chemistryMarks);
      const chemistryMaxMarks = parseOptionalNumber(data.chemistryMaxMarks);
      const mathematicsMarks = parseOptionalNumber(data.mathematicsMarks);
      const mathematicsMaxMarks = parseOptionalNumber(data.mathematicsMaxMarks);
      const physicsMinMarks = parseOptionalNumber(data.physicsMinMarks);
      const chemistryMinMarks = parseOptionalNumber(data.chemistryMinMarks);
      const mathematicsMinMarks = parseOptionalNumber(data.mathematicsMinMarks);
      const pcmMaxMarks = [
        physicsMaxMarks,
        chemistryMaxMarks,
        mathematicsMaxMarks,
      ];
      const pcmMarks = [physicsMarks, chemistryMarks, mathematicsMarks];
      const pcmMinMarks = [
        physicsMinMarks,
        chemistryMinMarks,
        mathematicsMinMarks,
      ];
      if (
        [...pcmMarks, ...pcmMaxMarks, ...pcmMinMarks].some(
          (value) => value !== null
        ) &&
        [...pcmMarks, ...pcmMaxMarks, ...pcmMinMarks].some(
          (value) => value === null
        )
      ) {
        throw new Error(
          "Physics, Chemistry, and Mathematics marks, maximum marks, and minimum marks are all required."
        );
      }
      for (let index = 0; index < pcmMarks.length; index++) {
        if (pcmMarks[index]! > pcmMaxMarks[index]!) {
          throw new Error("Obtained marks cannot exceed maximum marks.");
        }
        if (pcmMinMarks[index]! > pcmMaxMarks[index]!) {
          throw new Error("Minimum marks cannot exceed maximum marks.");
        }
      }
      const pcmPercentage =
        pcmMarks.every((value) => value !== null) &&
        pcmMaxMarks.every((value) => value !== null) &&
        pcmMaxMarks.every((value) => value! > 0)
          ? Number(
              (
                (pcmMarks.reduce((sum, value) => sum + value!, 0) /
                  pcmMaxMarks.reduce((sum, value) => sum + value!, 0)) *
                100
              ).toFixed(2)
            )
          : null;

      if (data.aadharNumber && data.aadharNumber !== admission.aadharNumber) {
        const existingAadhar = await db.admission.findFirst({
          where: {
            aadharNumber: data.aadharNumber,
            NOT: {
              id: admission.id,
            },
          },
        });

        if (existingAadhar) {
          throw new Error(
            `Aadhar number ${data.aadharNumber} is already registered.`
          );
        }
      }

      const updatedAdmission = await db.admission.update({
        where: {
          id: admission.id,
        },
        data: {
          status: "SUBMITTED",

          // Admission Details
          applicationId: data.applicationId,
          admissionType: data.admissionType,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          modeOfAdmission: data.modeOfAdmission,
          semesterId: admission.semesterId,
          departmentId: data.departmentId,
          categoryClaimed: data.categoryClaimed,
          categoryAllotted: data.categoryAllotted,
          quota: data.modeOfAdmission === "KCET" ? data.quota : null,

          entranceExamRank: data.entranceExamRank,
          originalAdmissionOrderNumber: data.originalAdmissionOrderNumber,
          originalAdmissionOrderDate: data.originalAdmissionOrderDate
            ? new Date(data.originalAdmissionOrderDate)
            : null,
          feePaid: data.feePaid ? parseFloat(data.feePaid) : null,
          feeReceiptNumber: data.feeReceiptNumber ?? null,
          scholarship: data.scholarship === "true",
          sspId: data.scholarship === "true" ? data.sspId?.trim() : null,
          abcAparId: data.abcAparId ?? null,
          counsellingRound: data.counsellingRound ?? null,
          dateOfAdmission: admission.dateOfAdmission ?? new Date(),
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
          primaryEmail,
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
          studiedKannadaIn10th: data.studiedKannadaIn10th === "true",
          passportNumber: data.passportNumber ?? null,
          passportExpiryDate: data.passportExpiryDate
            ? new Date(data.passportExpiryDate)
            : null,
          visaNumber: data.visaNumber ?? null,
          visaExpiryDate: data.visaExpiryDate
            ? new Date(data.visaExpiryDate)
            : null,
          parentPassportNumber: data.parentPassportNumber ?? null,
          parentVisaNumber: data.parentVisaNumber ?? null,
          parentVisaExpiryDate: data.parentVisaExpiryDate
            ? new Date(data.parentVisaExpiryDate)
            : null,

          class10thSchoolName: data.class10thSchoolName,
          class10thRollRegNumber: data.class10thRollRegNumber ?? null,
          admissionBasedOn: data.admissionBasedOn ?? null,
          class10thSchoolType: data.class10thSchoolType,
          schoolCountry: data.schoolCountry ?? null,
          class10thSchoolCity: data.class10thSchoolCity,
          class10thSchoolState: data.class10thSchoolState,
          class10thYearOfPassing: data.class10thYearOfPassing,
          class10thAggregateScore: data.class10thAggregateScore
            ? parseFloat(data.class10thAggregateScore)
            : null,
          class10thAggregateTotal: data.class10thAggregateTotal
            ? parseFloat(data.class10thAggregateTotal)
            : null,
          class10thMediumOfTeaching: data.class10thMediumOfTeaching,

          hasClass12: data.hasClass12 === "true",
          hasDiploma: data.hasDiploma === "true",
          class12thInstituteName: data.class12thInstituteName,
          class12thRollRegNumber: data.class12thRollRegNumber ?? null,
          class12thInstituteType: data.class12thInstituteType,
          instituteCountry: data.instituteCountry ?? null,
          class12thInstituteCity: data.class12thInstituteCity,
          class12thInstituteState: data.class12thInstituteState,
          class12thYearOfPassing: data.class12thYearOfPassing,
          class12thBranch: data.class12thBranch,
          class12thAggregateScore: data.class12thAggregateScore
            ? parseFloat(data.class12thAggregateScore)
            : null,
          class12thAggregateTotal: data.class12thAggregateTotal
            ? parseFloat(data.class12thAggregateTotal)
            : null,
          class12thMediumOfTeaching: data.class12thMediumOfTeaching,
          physicsMarks,
          physicsMaxMarks,
          physicsMinMarks,
          physicsPercentage: calculatePercentage(physicsMarks, physicsMaxMarks),
          chemistryMarks,
          chemistryMaxMarks,
          chemistryMinMarks,
          chemistryPercentage: calculatePercentage(
            chemistryMarks,
            chemistryMaxMarks
          ),
          mathematicsMarks,
          mathematicsMaxMarks,
          mathematicsMinMarks,
          mathematicsPercentage: calculatePercentage(
            mathematicsMarks,
            mathematicsMaxMarks
          ),
          pcmPercentage,

          diplomaInstituteName: data.diplomaInstituteName ?? null,
          diplomaInstituteType: data.diplomaInstituteType ?? null,
          diplomaCountry: data.diplomaCountry ?? null,
          diplomaInstituteCity: data.diplomaInstituteCity ?? null,
          diplomaInstituteState: data.diplomaInstituteState ?? null,
          diplomaYearOfPassing: data.diplomaYearOfPassing ?? null,
          diplomaBranch: data.diplomaBranch ?? null,
          diplomaMediumOfTeaching: data.diplomaMediumOfTeaching ?? null,
          diplomaAggregateScore: data.diplomaAggregateScore
            ? parseFloat(data.diplomaAggregateScore)
            : null,
          diplomaAggregateTotal: data.diplomaAggregateTotal
            ? parseFloat(data.diplomaAggregateTotal)
            : null,

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

          ...fileUrls,
        },
      });

      return {
        status: "success",
        message: "Application submitted successfully",
        data: updatedAdmission,
      };
    } catch (error) {
      logger.error("Failed to submit application", error);

      throw new Error(
        error instanceof Error ? error.message : "Failed to submit application"
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
  static async changeAdmissionMode(
    id: string,
    data: ChangeAdmissionModeType
  ): Promise<BaseResponse<unknown>> {
    try {
      const admission = await db.admission.findUnique({
        where: { id },
      });

      if (!admission) {
        throw new Error("Admission not found");
      }

      if (admission.status === "EXITED") {
        throw new Error(
          "Cannot change admission mode after the student has exited."
        );
      }

      const updatedAdmission = await db.admission.update({
        where: { id },
        data: {
          modeOfAdmission: data.modeOfAdmission,
          categoryClaimed: data.categoryClaimed,
          categoryAllotted: data.categoryAllotted,
          quota: data.modeOfAdmission === "KCET" ? (data.quota ?? null) : null,
          entranceExamRank:
            data.entranceExamRank != null
              ? String(data.entranceExamRank)
              : null,
          originalAdmissionOrderNumber: data.originalAdmissionOrderNumber,
          originalAdmissionOrderDate: data.originalAdmissionOrderDate
            ? new Date(data.originalAdmissionOrderDate)
            : null,
        },
        include: {
          semester: true,
          department: true,
        },
      });

      return {
        status: "success",
        message: "Admission mode updated successfully",
        data: updatedAdmission,
      };
    } catch (error) {
      logger.error("Failed to change admission mode", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to change admission mode"
      );
    }
  }

  static async exitAdmission(id: string): Promise<BaseResponse<unknown>> {
    try {
      const admission = await db.admission.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          studentId: true,
          applicationId: true,
        },
      });

      if (!admission) {
        throw new Error("Admission not found");
      }

      if (admission.status === "EXITED") {
        throw new Error("Student has already exited the college");
      }

      if (!admission.studentId) {
        throw new Error("Only admitted students can be marked as exited");
      }

      const updatedAdmission = await db.admission.update({
        where: { id },
        data: {
          status: "EXITED",
        },
      });

      return {
        status: "success",
        message: "Student marked as exited successfully",
        data: updatedAdmission,
      };
    } catch (error) {
      logger.error("Failed to exit admission", error);

      throw new Error(
        error instanceof Error ? error.message : "Failed to exit admission"
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
              programType: true,
              academicTerm: { select: { id: true, type: true, year: true } },
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

        return left.primaryEmail.localeCompare(right.primaryEmail);
      });

      const studentEmailCollisionCountsByDepartmentId = new Map<
        string,
        {
          firstNameCounts: Map<string, number>;
          firstNameLastInitialCounts: Map<string, number>;
        }
      >();

      for (const admission of approvedUnportedAdmissions) {
        if (!admission.departmentId) {
          continue;
        }

        const firstNameKey = normalizeStudentEmailToken(
          admission.firstName ?? ""
        );
        if (!firstNameKey) {
          continue;
        }

        const lastInitial = normalizeStudentEmailToken(
          admission.lastName ?? ""
        ).slice(0, 1);

        const counts = studentEmailCollisionCountsByDepartmentId.get(
          admission.departmentId
        ) ?? {
          firstNameCounts: new Map<string, number>(),
          firstNameLastInitialCounts: new Map<string, number>(),
        };

        counts.firstNameCounts.set(
          firstNameKey,
          (counts.firstNameCounts.get(firstNameKey) ?? 0) + 1
        );

        const compositeKey = lastInitial
          ? `${firstNameKey}:${lastInitial}`
          : firstNameKey;
        counts.firstNameLastInitialCounts.set(
          compositeKey,
          (counts.firstNameLastInitialCounts.get(compositeKey) ?? 0) + 1
        );

        studentEmailCollisionCountsByDepartmentId.set(
          admission.departmentId,
          counts
        );
      }

      const studentEmailLocalPartsByDepartmentId = new Map<
        string,
        Set<string>
      >();
      const academicYearSuffix = getStudentEmailYearSuffix(
        semester.academicTerm.year
      );

      const unportedApplicationIds = approvedUnportedAdmissions.map(
        (admission) => admission.primaryEmail
      );

      let userIdByApplicationId = new Map<string, string>();
      let autoCreatedUsers = 0;

      if (unportedApplicationIds.length > 0) {
        const resolvedApplicantUsers =
          await AdmissionService.resolveApplicantUsersForPort(
            unportedApplicationIds,
            headers
          );
        userIdByApplicationId = resolvedApplicantUsers.userIdByApplicationId;
        autoCreatedUsers = resolvedApplicantUsers.autoCreatedUsers;
      }

      let newlyPorted = 0;
      let alreadyPorted = 0;
      const failedPorts: { applicationId: string; reason: string }[] = [];

      for (const admission of approvedUnportedAdmissions) {
        try {
          const userId = userIdByApplicationId.get(
            AdmissionService.normalizeApplicationId(admission.primaryEmail)
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
            const firstName = admission.firstName?.trim();
            const lastName = admission.lastName?.trim();

            if (!fullName) {
              throw new Error(
                `Cannot port ${admission.applicationId}: student full name is missing`
              );
            }

            if (!firstName) {
              throw new Error(
                `Cannot port ${admission.applicationId}: student first name is missing`
              );
            }

            const firstNameKey = normalizeStudentEmailToken(firstName);
            const lastInitial = normalizeStudentEmailToken(
              lastName ?? ""
            ).slice(0, 1);

            const collisionCounts =
              studentEmailCollisionCountsByDepartmentId.get(
                admission.departmentId
              ) ?? {
                firstNameCounts: new Map<string, number>(),
                firstNameLastInitialCounts: new Map<string, number>(),
              };

            let occupiedLocalParts = studentEmailLocalPartsByDepartmentId.get(
              admission.departmentId
            );

            if (!occupiedLocalParts) {
              const sameDepartmentEmails = await tx.user.findMany({
                where: {
                  id: { not: userId },
                  email: {
                    endsWith: `.${normalizeStudentEmailToken(
                      department.code
                    )}${academicYearSuffix}@bmsce.ac.in`,
                    mode: "insensitive",
                  },
                },
                select: {
                  email: true,
                },
              });

              occupiedLocalParts = new Set(
                sameDepartmentEmails.map(
                  (user) => user.email.trim().toLowerCase().split("@")[0] ?? ""
                )
              );

              studentEmailLocalPartsByDepartmentId.set(
                admission.departmentId,
                occupiedLocalParts
              );
            }

            const studentEmail = buildStudentEmailAddress({
              firstName,
              lastName,
              departmentCode: department.code,
              academicYear: semester.academicTerm.year,
              firstNameCount:
                collisionCounts.firstNameCounts.get(firstNameKey) ?? 0,
              firstNameLastInitialCount: lastInitial
                ? (collisionCounts.firstNameLastInitialCounts.get(
                    `${firstNameKey}:${lastInitial}`
                  ) ?? 0)
                : (collisionCounts.firstNameLastInitialCounts.get(
                    firstNameKey
                  ) ?? 0),
              occupiedLocalParts,
            });

            occupiedLocalParts.add(studentEmail.split("@")[0] ?? studentEmail);

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
              const academicTermLabel = `${semester.academicTerm.type.toUpperCase()} ${semester.academicTerm.year}`;

              await tx.student.update({
                where: { id: existingStudent.id },
                data: {
                  departmentName: department.name,
                  currentSemester: semester.semesterNumber,
                  academicYear: semester.academicTerm.year,
                  semesterId: semester.id,
                  semesterNumber: semester.semesterNumber,
                  programType: semester.programType,
                  academicTermId: semester.academicTerm.id,
                  academicTermType: semester.academicTerm.type,
                  academicTermYear: semester.academicTerm.year,
                  academicTermLabel,
                },
              });

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
                  email: studentEmail,
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
                semesterId: semester.id,
                semesterNumber: semester.semesterNumber,
                programType: semester.programType,
                academicTermId: semester.academicTerm.id,
                academicTermType: semester.academicTerm.type,
                academicTermYear: semester.academicTerm.year,
                academicTermLabel: `${semester.academicTerm.type.toUpperCase()} ${semester.academicTerm.year}`,
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
                email: studentEmail,
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
            applicationId: admission.primaryEmail,
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
