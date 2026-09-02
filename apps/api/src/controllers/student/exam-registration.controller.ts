import { ExamRegistrationService } from "@webcampus/api/src/services/student/exam-registration.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  ExamRegistrationEligibilityType,
  ExamRegistrationHistoryItemType,
  SubmitExamRegistrationResponseType,
  SubmitExamRegistrationType,
} from "@webcampus/schemas/student";
import { Request, Response } from "express";

export class ExamRegistrationController {
  static async getEligibleCourses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;

      if (!userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const response = await ExamRegistrationService.getEligibleCourses(userId);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data as ExamRegistrationEligibilityType,
        });
      }
    } catch (error) {
      logger.error("Failed to fetch examination eligibility", error);
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

  static async submitExamRegistrations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.requestContext?.userId;

      if (!userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const response = await ExamRegistrationService.submitExamRegistrations(
        userId,
        req.body as SubmitExamRegistrationType
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 201,
          message: response.message,
          data: response.data as SubmitExamRegistrationResponseType,
        });
      }
    } catch (error) {
      logger.error("Failed to submit examination registrations", error);
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

  static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;

      if (!userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const response = await ExamRegistrationService.getHistory(userId);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data as ExamRegistrationHistoryItemType[],
        });
      }
    } catch (error) {
      logger.error("Failed to fetch examination history", error);
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
