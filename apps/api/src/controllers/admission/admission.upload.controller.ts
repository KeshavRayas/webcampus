import { AdmissionUploadService } from "@webcampus/api/src/services/admission/admission.upload.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class AdmissionUploadController {
  static async uploadDocuments(req: Request, res: Response): Promise<void> {
    try {
      const files = (req.files ?? {}) as {
        [fieldname: string]: Express.Multer.File[];
      };

      const response = await AdmissionUploadService.uploadDocuments(
        req.params.id as string,
        files
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
        return;
      }

      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message: response.message,
        error: response.error,
      });
    } catch (error) {
      logger.error("Error uploading admission documents", error);
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
