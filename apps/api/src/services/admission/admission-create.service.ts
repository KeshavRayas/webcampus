import { randomUUID } from "crypto";
import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { CreateAdmissionShellType } from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";
import {
  calculatePercentage,
  ensureApplicantUser,
  generateTempUsnWithClient,
  parseOptionalNumber,
} from "./admission.shared";

export class AdmissionCreateService {
  static async createShell(
    data: CreateAdmissionShellType,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(headers),
      });
      const filledById = session?.user?.id;

      if (!filledById) {
        throw new Error("Unauthorized");
      }

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
          username: (applicantEmail.split("@")[0] ?? "").trim().toLowerCase(),
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
          applicationId: randomUUID(),
          primaryEmail: data.primaryEmail,

          semesterId: data.semesterId,
          departmentId: department.id,
          filledById,

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

  static async generateTempUsn(
    semesterId: string,
    branchCode: string
  ): Promise<string> {
    return generateTempUsnWithClient(db, semesterId, branchCode);
  }

  static async submitApplication(
    primaryEmail: string,
    data: Record<string, string>,
    fileUrls: { [key: string]: string },
    headers: IncomingHttpHeaders,
    filledById?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      logger.info("submitApplication called", {
        primaryEmail,
        receivedFields: Object.keys(data),
      });
      logger.info({
        primaryEmail,
      });

      const admission = await db.admission.findFirst({
        where: {
          primaryEmail,
        },
        include: {
          semester: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!admission) {
        throw new Error("Admission application not found.");
      }

      await ensureApplicantUser(primaryEmail, headers, data.nameAsPer10th);

      const actorId =
        filledById ??
        (
          await db.user.findUnique({
            where: { email: primaryEmail },
            select: { id: true },
          })
        )?.id;

      if (!actorId) {
        throw new Error("Unable to identify the user who filled the form.");
      }

      if (admission.status === "SUBMITTED" && !filledById) {
        throw new Error("Application has already been submitted.");
      }

      if (!data.admissionType) {
        throw new Error("Admission type is required.");
      }

      if (!data.abcAparId?.trim()) {
        throw new Error("ABC/APAAR ID is required.");
      }

      if (!data.nationality?.trim()) {
        throw new Error("Nationality is required.");
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

      if (data.departmentId) {
        const deptExists = await db.department.findUnique({
          where: { id: data.departmentId },
          select: { id: true },
        });
        if (!deptExists) {
          throw new Error(
            `Department ${data.departmentId} not found — it may have been deleted or the ID is stale. Please refresh the department list and try again.`
          );
        }
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
      const pcmMaxMarks = [
        physicsMaxMarks,
        chemistryMaxMarks,
        mathematicsMaxMarks,
      ];
      const pcmMarks = [physicsMarks, chemistryMarks, mathematicsMarks];
      if (
        [...pcmMarks, ...pcmMaxMarks].some((value) => value !== null) &&
        [...pcmMarks, ...pcmMaxMarks].some((value) => value === null)
      ) {
        throw new Error(
          "Physics, Chemistry, and Mathematics marks and maximum marks are all required."
        );
      }
      for (let index = 0; index < pcmMarks.length; index++) {
        if (pcmMarks[index]! > pcmMaxMarks[index]!) {
          throw new Error("Obtained marks cannot exceed maximum marks.");
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
          applicationId:
            admission.applicationId || data.applicationId || randomUUID(),
          admissionType: data.admissionType,
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

          // Personal Information
          nameAsPer10th: data.nameAsPer10th,
          dob: data.dob ? new Date(data.dob) : null,
          bloodGroup: data.bloodGroup,
          gender: data.gender,
          primaryPhoneNumber: data.primaryPhoneNumber,
          secondaryPhoneNumber: data.secondaryPhoneNumber,
          emergencyContactNumber: data.emergencyContactNumber,
          primaryEmail,
          filledById: actorId,
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
          physicsPercentage: calculatePercentage(physicsMarks, physicsMaxMarks),
          chemistryMarks,
          chemistryMaxMarks,
          chemistryPercentage: calculatePercentage(
            chemistryMarks,
            chemistryMaxMarks
          ),
          mathematicsMarks,
          mathematicsMaxMarks,
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
          fatherAnnualIncome: data.fatherAnnualIncome ?? null,

          motherName: data.motherName,
          motherEmail: data.motherEmail,
          motherNumber: data.motherNumber,
          motherPermanentAddress: data.motherPermanentAddress,
          motherOccupation: data.motherOccupation ?? null,
          motherAnnualIncome: data.motherAnnualIncome ?? null,

          guardianName: data.guardianName ?? null,
          guardianEmail: data.guardianEmail ?? null,
          guardianNumber: data.guardianNumber ?? null,
          guardianPermanentAddress: data.guardianPermanentAddress ?? null,
          guardianOccupation: data.guardianOccupation ?? null,
          guardianAnnualIncome: data.guardianAnnualIncome ?? null,

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

      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2003"
      ) {
        const meta = (error as { meta?: { field_name?: string } }).meta;
        const field = meta?.field_name || "department or semester";
        throw new Error(
          `Foreign key violation on ${field} — the selected department or semester no longer exists. Please refresh and try again.`
        );
      }

      throw new Error(
        error instanceof Error ? error.message : "Failed to submit application"
      );
    }
  }

  static async createAndSubmitApplication(
    primaryEmail: string,
    data: Record<string, string>,
    fileUrls: { [key: string]: string },
    filledById: string,
    headers: IncomingHttpHeaders,
    admissionId?: string
  ): Promise<BaseResponse<unknown>> {
    if (!data.semesterId || !data.departmentId) {
      throw new Error("Semester and department are required");
    }

    const [deptExists, semExists] = await Promise.all([
      db.department.findUnique({
        where: { id: data.departmentId },
        select: { id: true },
      }),
      db.semester.findUnique({
        where: { id: data.semesterId },
        select: { id: true },
      }),
    ]);

    if (!deptExists) {
      throw new Error(
        `Department ${data.departmentId} not found — it may have been deleted or the ID is stale. Please refresh the department list and try again.`
      );
    }
    if (!semExists) {
      throw new Error(
        `Semester ${data.semesterId} not found — it may have been deleted or the ID is stale. Please refresh and try again.`
      );
    }

    const existingAdmission = await db.admission.findFirst({
      where: { primaryEmail },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    try {
      if (existingAdmission) {
        // Staff editing flow: update the existing admission record in place.
        return await AdmissionCreateService.submitApplication(
          primaryEmail,
          data,
          fileUrls,
          headers,
          filledById
        );
      }

      await db.admission.create({
        data: {
          id: admissionId || randomUUID(),
          applicationId: randomUUID(),
          primaryEmail,
          semesterId: data.semesterId,
          departmentId: data.departmentId,
          filledById,
          status: "PENDING",
        },
      });

      return await AdmissionCreateService.submitApplication(
        primaryEmail,
        data,
        fileUrls,
        headers,
        filledById
      );
    } catch (error) {
      const createdAdmission = await db.admission.findFirst({
        where: { primaryEmail },
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
      });

      if (createdAdmission && createdAdmission.status === "PENDING") {
        await db.admission.delete({ where: { id: createdAdmission.id } });
      }

      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2003"
      ) {
        const meta = (error as { meta?: { field_name?: string } }).meta;
        const field = meta?.field_name || "department or semester";
        throw new Error(
          `Foreign key violation on ${field} — the selected department or semester no longer exists. Please refresh and try again.`
        );
      }

      throw error;
    }
  }
}
