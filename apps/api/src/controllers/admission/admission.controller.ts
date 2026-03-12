import { AdmissionService } from "@webcampus/api/src/services/admission/admission.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { CreateAdmissionShellType } from "@webcampus/schemas/admission";
import { Request, Response } from "express";

export class AdmissionController {
  static async createShell(req: Request, res: Response): Promise<void> {
    try {
      const requestData = req.body as CreateAdmissionShellType;

      const response = await AdmissionService.createShell(
        requestData,
        req.headers
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 201,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error creating admission shell", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async getBySemester(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId } = req.params;
      const response = await AdmissionService.getAdmissionsBySemester(
        semesterId as string
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error fetching admissions", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      // 1. FOOLPROOF WAY: Get session directly from Better Auth
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const userId = session?.user?.id;

      if (!userId) throw new Error("Unauthorized: User session not found");

      // 2. Fetch the user from the DB to get their Application ID
      const user = await db.user.findUnique({ where: { id: userId } });
      const applicationId = user?.username;

      if (!applicationId) {
        throw new Error("Unauthorized: Applicant ID not found");
      }

      // 3. Fetch their admission shell
      const response = await AdmissionService.getByApplicationId(applicationId);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error fetching applicant profile", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 500,
        error,
      });
    }
  }

  static async deleteAdmission(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await AdmissionService.deleteAdmission(id as string);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error deleting admission", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async submit(req: Request, res: Response): Promise<void> {
    try {
      // 1. FOOLPROOF WAY: Get session directly from Better Auth
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const userId = session?.user?.id;

      if (!userId) throw new Error("Unauthorized: User session not found");

      const user = await db.user.findUnique({ where: { id: userId } });
      const applicationId = user?.username;

      if (!applicationId)
        throw new Error("Unauthorized: Applicant ID not found");

      // 2. Process the Multer files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const fileUrls: { [key: string]: string } = {};

      const { uploadToS3, generateFileName } = await import(
        "@webcampus/api/src/utils/s3"
      );

      const handleUpload = async (field: string, prefix: string) => {
        if (files && files[field] && files[field][0]) {
          const file = files[field][0];
          const fileName = generateFileName(file.originalname, prefix);
          const result = await uploadToS3(file.buffer, fileName, file.mimetype);
          if (result.success && result.url) {
            fileUrls[field] = result.url;
          }
        }
      };

      await Promise.all([
        handleUpload("class10thMarksPdf", "10th_marks_"),
        handleUpload("class12thMarksPdf", "12th_marks_"),
        handleUpload("casteCertificate", "caste_cert_"),
        handleUpload("photo", "photo_"),
      ]);

      // 3. Submit to the service
      const response = await AdmissionService.submitApplication(
        applicationId,
        req.body,
        fileUrls
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error submitting application", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 400,
        error,
      });
    }
  }
}
