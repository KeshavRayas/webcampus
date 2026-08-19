import { AdmissionCancelService } from "@webcampus/api/src/services/admission/admission-cancel.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { CancelAdmissionType } from "@webcampus/schemas/admission";
import { Request, Response } from "express";

export class AdmissionCancelController {
  static async cancelAdmission(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionCancelService.cancelAdmission(
        req.params.id as string,
        req.body as CancelAdmissionType,
        req.headers
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: response.message,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error cancelling admission", error);
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
}
