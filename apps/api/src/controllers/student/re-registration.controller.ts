import { ReRegistrationService } from "@webcampus/api/src/services/student/re-registration.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { SubmitReRegistrationType } from "@webcampus/schemas/student";
import { Request, Response } from "express";

export class ReRegistrationController {
  static async getEligibleCourses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;
      if (!userId) {
        sendResponse({
          res,
          status: "error",
          message: ERRORS.UNAUTHORIZED,
          statusCode: 401,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const response = await ReRegistrationService.getEligibleCourses(userId);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      }
    } catch (error) {
      logger.error("Error retrieving re-registration eligibility:", { error });
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

  static async submitReRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.requestContext?.userId;
      if (!userId) {
        sendResponse({
          res,
          status: "error",
          message: ERRORS.UNAUTHORIZED,
          statusCode: 401,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const request: SubmitReRegistrationType = req.body;
      const response = await ReRegistrationService.submitReRegistration(
        userId,
        request
      );
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 201,
        });
      }
    } catch (error) {
      logger.error("Error submitting re-registration:", { error });
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

  static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;
      if (!userId) {
        sendResponse({
          res,
          status: "error",
          message: ERRORS.UNAUTHORIZED,
          statusCode: 401,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const response = await ReRegistrationService.getHistory(userId);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      }
    } catch (error) {
      logger.error("Error retrieving re-registration history:", { error });
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
