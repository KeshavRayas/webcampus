import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { CreateAdmissionShellType } from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";

export class AdmissionService {
  static async createShell(
    data: CreateAdmissionShellType,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      // 1. Create the applicant auth user
      // We generate a dummy email and name since they haven't filled it out yet
      const userService = new UserService({
        request: {
          email: `${data.applicationId.toLowerCase()}@applicant.local`,
          name: `Applicant ${data.applicationId}`,
          username: data.applicationId, // The student will log in using this!
          password: "password", // Default password
          role: "applicant", // Our newly created role
        },
        headers,
      });

      const authUser = await userService.create();

      if (authUser.status === "error" || !authUser.data?.id) {
        throw new Error(
          authUser.message || "Failed to create applicant user account"
        );
      }

      // 2. Create the Admission Shell in the database
      const admission = await db.admission.create({
        data: {
          applicationId: data.applicationId,
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
        message: "Admission shell and applicant account created successfully",
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

  static async getAdmissionsBySemester(
    semesterId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const admissions = await db.admission.findMany({
        where: { semesterId },
        orderBy: { createdAt: "desc" },
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
      // 1. Fetch the admission record
      const admission = await db.admission.findUnique({ where: { id } });
      if (!admission) throw new Error("Admission not found");

      // 2. Delete associated S3 files if they exist
      const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
      const fileUrls = [
        admission.photo,
        admission.class10thMarksPdf,
        admission.class12thMarksPdf,
        admission.casteCertificate,
      ].filter(
        (url): url is string => typeof url === "string" && url.length > 0
      );

      await Promise.all(fileUrls.map((url) => deleteFromS3(url)));

      // 3. Delete the database record
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

  static async submitApplication(
    applicationId: string,
    data: Record<string, string>, // Text fields
    fileUrls: { [key: string]: string } // S3 URLs
  ): Promise<BaseResponse<unknown>> {
    try {
      // 1. Find the existing shell case-insensitively
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

      // 2. Update the record using its exact unique database ID
      const updatedAdmission = await db.admission.update({
        where: { id: existingAdmission.id }, // <--- Update by ID instead of applicationId
        data: {
          status: "SUBMITTED",
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          address: data.address,
          gender: data.gender,
          fatherName: data.fatherName,
          motherName: data.motherName,
          fatherEmail: data.fatherEmail,
          motherEmail: data.motherEmail,
          fatherNumber: data.fatherNumber,
          motherNumber: data.motherNumber,
          class10thMarks: data.class10thMarks
            ? parseFloat(data.class10thMarks)
            : null,
          class12thMarks: data.class12thMarks
            ? parseFloat(data.class12thMarks)
            : null,
          class10thSchoolName: data.class10thSchoolName,
          class12thSchoolName: data.class12thSchoolName,

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
          ...(fileUrls.photo && { photo: fileUrls.photo }),
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
