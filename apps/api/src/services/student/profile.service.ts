import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  StudentProfileStatusEnum,
  UpdateStudentProfileType,
} from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";

const modeToAidedStatus = (modeOfAdmission?: string | null) => {
  if (!modeOfAdmission) return null;
  const normalized = modeOfAdmission.toLowerCase();
  if (normalized.includes("unaided") || normalized.includes("un-aided")) {
    return "UNAIDED" as const;
  }
  if (normalized.includes("aided")) {
    return "AIDED" as const;
  }
  return null;
};

const mergeAddress = (
  currentAddress?: string | null,
  currentArea?: string | null,
  currentCity?: string | null,
  currentDistrict?: string | null,
  currentState?: string | null,
  currentCountry?: string | null,
  currentPincode?: string | null
) => {
  const segments = [
    currentAddress,
    currentArea,
    currentCity,
    currentDistrict,
    currentState,
    currentCountry,
    currentPincode,
  ].filter(Boolean);

  return segments.length ? segments.join(", ") : null;
};

export class StudentProfileService {
  static async getProfileByUserId(userId: string): Promise<BaseResponse<unknown>> {
    try {
      const student = await db.student.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          admission: {
            select: {
              id: true,
              status: true,
              dob: true,
              gender: true,
              bloodGroup: true,
              caste: true,
              primaryEmail: true,
              secondaryEmail: true,
              primaryPhoneNumber: true,
              secondaryPhoneNumber: true,
              emergencyContactNumber: true,
              aadharNumber: true,
              quota: true,
              nationality: true,
              permanentAddress: true,
              currentAddress: true,
              currentArea: true,
              currentCity: true,
              currentDistrict: true,
              currentState: true,
              currentCountry: true,
              currentPincode: true,
              fatherName: true,
              fatherQualification: true,
              fatherOccupation: true,
              fatherNumber: true,
              fatherEmail: true,
              motherName: true,
              motherQualification: true,
              motherOccupation: true,
              motherNumber: true,
              motherEmail: true,
              class10thSchoolName: true,
              class10thSchoolType: true,
              class10thAggregateScore: true,
              class10thAggregateTotal: true,
              class10thYearOfPassing: true,
              class12thInstituteName: true,
              class12thInstituteType: true,
              class12thAggregateScore: true,
              class12thAggregateTotal: true,
              class12thYearOfPassing: true,
              entranceExamRank: true,
              aadharCard: true,
              photo: true,
              class10thMarksPdf: true,
              class12thMarksPdf: true,
              studyCertificate: true,
              transferCertificate: true,
              modeOfAdmission: true,
              passportNumber: true,
              visaValidityDetails: true,
            },
          },
          studentSections: {
            orderBy: {
              semester: "desc",
            },
            take: 1,
            include: {
              section: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!student) {
        throw new Error("Student profile not found");
      }

      const latestSection = student.studentSections[0];
      const admission = student.admission;

      return {
        status: "success",
        message: "Student profile fetched successfully",
        data: {
          id: student.id,
          usn: student.usn,
          currentSemester: student.currentSemester,
          academicYear: student.academicYear,
          departmentName: student.departmentName,
          programType: student.programType,
          semesterNumber: student.semesterNumber,
          user: student.user,
          admissionStatus: admission?.status ?? null,
          profile: {
            fullName: student.user.name,
            collegeEmail: student.user.email,
            mobileNumber: admission?.primaryPhoneNumber ?? null,
            dob: admission?.dob ?? null,
            gender: admission?.gender ?? null,
            bloodGroup: admission?.bloodGroup ?? null,
            aidedStatus: modeToAidedStatus(admission?.modeOfAdmission),
            category: admission?.caste ?? null,
            personalEmail: admission?.primaryEmail ?? null,
            alternatePhone:
              admission?.secondaryPhoneNumber ?? admission?.emergencyContactNumber ?? null,
            aadhaarNumber: admission?.aadharNumber ?? null,
            admissionQuota: admission?.quota ?? null,
            nationality: admission?.nationality ?? null,
            passportNumber: admission?.passportNumber ?? null,
            visaValidityDetails: admission?.visaValidityDetails ?? null,
            permanentAddress: admission?.permanentAddress ?? null,
            presentAddress:
              admission?.currentAddress ??
              mergeAddress(
                admission?.currentAddress,
                admission?.currentArea,
                admission?.currentCity,
                admission?.currentDistrict,
                admission?.currentState,
                admission?.currentCountry,
                admission?.currentPincode
              ),
            sameAsPermanentAddress:
              Boolean(admission?.permanentAddress) &&
              admission?.permanentAddress === admission?.currentAddress,
            father: {
              name: admission?.fatherName ?? null,
              occupation: admission?.fatherOccupation ?? null,
              qualification: admission?.fatherQualification ?? null,
              mobile: admission?.fatherNumber ?? null,
              email: admission?.fatherEmail ?? null,
            },
            mother: {
              name: admission?.motherName ?? null,
              occupation: admission?.motherOccupation ?? null,
              qualification: admission?.motherQualification ?? null,
              mobile: admission?.motherNumber ?? null,
              email: admission?.motherEmail ?? null,
            },
            academic: {
              academicYear: student.academicYear,
              departmentName: student.departmentName,
              programme: student.programType ? `BE - ${student.programType}` : null,
              semester: student.currentSemester,
              section: latestSection?.section?.name ?? null,
            },
            education: {
              class10: {
                school: admission?.class10thSchoolName ?? null,
                board: admission?.class10thSchoolType ?? null,
                percentage:
                  admission?.class10thAggregateScore != null &&
                  admission?.class10thAggregateTotal
                    ? Number(
                        ((admission.class10thAggregateScore /
                          admission.class10thAggregateTotal) *
                          100).toFixed(2)
                      )
                    : null,
                year: admission?.class10thYearOfPassing ?? null,
              },
              class12OrDiploma: {
                school: admission?.class12thInstituteName ?? null,
                board: admission?.class12thInstituteType ?? null,
                percentage:
                  admission?.class12thAggregateScore != null &&
                  admission?.class12thAggregateTotal
                    ? Number(
                        ((admission.class12thAggregateScore /
                          admission.class12thAggregateTotal) *
                          100).toFixed(2)
                      )
                    : null,
                year: admission?.class12thYearOfPassing ?? null,
              },
              entranceExamDetails: admission?.entranceExamRank ?? null,
            },
            documents: {
              aadhaarCard: admission?.aadharCard ?? null,
              photo: admission?.photo ?? null,
              marksCards: admission?.class12thMarksPdf ?? admission?.class10thMarksPdf ?? null,
              otherDocuments:
                admission?.studyCertificate ?? admission?.transferCertificate ?? null,
            },
          },
        },
      };
    } catch (error) {
      logger.error("Error retrieving student profile", error);
      throw error;
    }
  }

  static async updateProfileByUserId(
    userId: string,
    payload: UpdateStudentProfileType
  ): Promise<BaseResponse<unknown>> {
    try {
      const student = await db.student.findUnique({
        where: { userId },
        include: { admission: true },
      });

      if (!student) {
        throw new Error("Student profile not found");
      }

      if (!student.admission) {
        throw new Error("Admission record not linked for this student");
      }

      const updated = await db.$transaction(async (tx) => {
        if (payload.fullName) {
          await tx.user.update({
            where: { id: userId },
            data: { name: payload.fullName },
          });
        }

        const class10Percentage = payload.class10Percentage;
        const class12Percentage = payload.class12Percentage;

        const nextCurrentAddress =
          payload.sameAsPermanentAddress && payload.permanentAddress
            ? payload.permanentAddress
            : payload.presentAddress;

        const admissionUpdateData = {
          dob: payload.dob,
          gender: payload.gender,
          bloodGroup: payload.bloodGroup,
          modeOfAdmission: payload.aidedStatus ?? undefined,
          caste: payload.category,
          quota:
            payload.admissionQuota === "MERIT" ||
            payload.admissionQuota === "MANAGEMENT" ||
            payload.admissionQuota === "SPORTS" ||
            payload.admissionQuota === "NRI" ||
            payload.admissionQuota === "SNQ"
              ? payload.admissionQuota
              : undefined,
          primaryEmail: payload.personalEmail,
          secondaryEmail: payload.personalEmail,
          secondaryPhoneNumber: payload.alternatePhone,
          aadharNumber: payload.aadhaarNumber,
          nationality: payload.nationality,
          passportNumber: payload.passportNumber,
          visaValidityDetails: payload.visaValidityDetails,
          permanentAddress: payload.permanentAddress,
          currentAddress: nextCurrentAddress,
          fatherName: payload.fatherName,
          fatherQualification: payload.fatherQualification,
          fatherOccupation: payload.fatherOccupation,
          fatherNumber: payload.fatherMobile,
          fatherEmail: payload.fatherEmail,
          motherName: payload.motherName,
          motherQualification: payload.motherQualification,
          motherOccupation: payload.motherOccupation,
          motherNumber: payload.motherMobile,
          motherEmail: payload.motherEmail,
          class10thSchoolName: payload.class10School,
          class10thSchoolType: payload.class10Board,
          class10thAggregateScore: class10Percentage,
          class10thAggregateTotal: class10Percentage != null ? 100 : undefined,
          class10thYearOfPassing: payload.class10Year,
          class12thInstituteName: payload.class12Institute,
          class12thInstituteType: payload.class12Board,
          class12thAggregateScore: class12Percentage,
          class12thAggregateTotal: class12Percentage != null ? 100 : undefined,
          class12thYearOfPassing: payload.class12Year,
          entranceExamRank: payload.entranceExamDetails,
          aadharCard: payload.aadhaarCardUrl,
          photo: payload.photoUrl,
          class12thMarksPdf: payload.marksCardsUrl,
          studyCertificate: payload.otherDocumentsUrl,
        };

        await tx.admission.update({
          where: { id: student.admission!.id },
          data: admissionUpdateData,
        });

        const reloaded = await tx.student.findUnique({
          where: { id: student.id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            admission: true,
          },
        });

        return reloaded;
      });

      return {
        status: "success",
        message: "Student profile updated successfully",
        data: updated,
      };
    } catch (error) {
      logger.error("Error updating student profile", error);
      throw error;
    }
  }

  static async requestApprovalByUserId(userId: string): Promise<BaseResponse<unknown>> {
    try {
      const student = await db.student.findUnique({
        where: { userId },
        include: { admission: true },
      });

      if (!student || !student.admission) {
        throw new Error("Admission record not linked for this student");
      }

      const currentStatus = student.admission.status;
      if (currentStatus === StudentProfileStatusEnum.enum.APPROVED) {
        return {
          status: "success",
          message: "Profile is already approved",
          data: student.admission,
        };
      }

      const updated = await db.admission.update({
        where: { id: student.admission.id },
        data: { status: StudentProfileStatusEnum.enum.SUBMITTED },
      });

      return {
        status: "success",
        message: "Profile approval request submitted",
        data: updated,
      };
    } catch (error) {
      logger.error("Error requesting student profile approval", error);
      throw error;
    }
  }
}
