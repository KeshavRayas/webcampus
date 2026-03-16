import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  CreateAdmissionShellType,
  GetAdmissionsQueryType,
} from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";

export class AdmissionService {
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
        const userService = new UserService({
          request: {
            email: applicantEmail,
            name: `Applicant ${applicationId}`,
            username: applicationId,
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
      include: { semester: true },
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

      // Delete the database record
      await db.admission.delete({ where: { id } });

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

  static async generateTempUsn(
    semesterId: string,
    branchCode: string
  ): Promise<string> {
    try {
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const yearPrefix = semester.year.toString().slice(-2);
      const formattedBranch = branchCode.toUpperCase().substring(0, 2);
      const prefix = `1BM${yearPrefix}${formattedBranch}`;

      const lastAdmission = await db.admission.findFirst({
        where: { tempUsn: { startsWith: prefix } },
        orderBy: { tempUsn: "desc" },
      });

      if (!lastAdmission || !lastAdmission.tempUsn) return `${prefix}001`;

      const lastNumberStr = lastAdmission.tempUsn.slice(-3);
      const lastNumber = parseInt(lastNumberStr, 10);

      if (isNaN(lastNumber)) return `${prefix}001`;

      let nextNumber = lastNumber + 1;
      if (nextNumber > 399 && nextNumber < 600) nextNumber = 600;

      return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
    } catch (error) {
      logger.error("Failed to generate Temp USN", error);
      throw new Error("Failed to generate Temp USN");
    }
  }

  static async submitApplication(
    applicationId: string,
    data: Record<string, string>, // Text fields
    fileUrls: { [key: string]: string } // S3 URLs
  ): Promise<BaseResponse<unknown>> {
    try {
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
        throw new Error("Admission shell not found.");
      }

      const branchCode = data.branch || "XX";
      const tempUsn = await AdmissionService.generateTempUsn(
        existingAdmission.semesterId,
        branchCode
      );

      // Update the record using its exact unique database ID
      const updatedAdmission = await db.admission.update({
        where: { id: existingAdmission.id }, // Update by ID instead of applicationId
        data: {
          status: "SUBMITTED",

          // Admission Details
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          branch: data.branch,
          categoryClaimed: data.categoryClaimed,
          categoryAllotted: data.categoryAllotted,
          quota: data.quota,
          entranceExamRank: data.entranceExamRank,
          originalAdmissionOrderNumber: data.originalAdmissionOrderNumber,
          originalAdmissionOrderDate: data.originalAdmissionOrderDate
            ? new Date(data.originalAdmissionOrderDate)
            : null,
          feePayable: data.feePayable ? parseFloat(data.feePayable) : null,
          feePaid: data.feePaid ? parseFloat(data.feePaid) : null,
          hostel: data.hostel === "true",
          hostelRoomNumber: data.hostelRoomNumber ?? null,

          tempUsn: tempUsn,

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
      logger.error("Failed to submit application", error);
      throw new Error("Failed to submit application");
    }
  }
}
