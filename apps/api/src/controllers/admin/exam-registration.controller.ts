import { ExamRegistrationAdminService } from "@webcampus/api/src/services/admin/exam-registration.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { GetExamRegistrationsQueryType } from "@webcampus/schemas/admin";
import { Request, Response } from "express";

export class ExamRegistrationAdminController {
  static async getRegistrations(req: Request, res: Response): Promise<void> {
    try {
      const response = await ExamRegistrationAdminService.getRegistrations(
        req.query as unknown as GetExamRegistrationsQueryType
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
      logger.error("Failed to fetch exam registrations", error);
      sendResponse({
        res,
        status: "error",
        statusCode:
          error instanceof Error && error.message.includes("not found")
            ? 404
            : 400,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
