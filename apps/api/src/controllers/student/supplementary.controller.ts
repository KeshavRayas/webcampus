import { SupplementaryService } from "@webcampus/api/src/services/student/supplementary.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  SubmitSupplementaryResponseType,
  SubmitSupplementaryType,
  SupplementaryEligibilityType,
  SupplementaryHistoryItemType,
} from "@webcampus/schemas/student";
import { Request, Response } from "express";

export class SupplementaryController {
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

      const response = await SupplementaryService.getEligibleCourses(userId);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data as SupplementaryEligibilityType,
        });
      }
    } catch (error) {
      logger.error("Failed to fetch supplementary eligibility", error);
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

  static async submitSupplementary(req: Request, res: Response): Promise<void> {
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

      const response = await SupplementaryService.submitSupplementary(
        userId,
        req.body as SubmitSupplementaryType
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 201,
          message: response.message,
          data: response.data as SubmitSupplementaryResponseType,
        });
      }
    } catch (error) {
      logger.error("Failed to submit supplementary registrations", error);
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

      const response = await SupplementaryService.getHistory(userId);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data as SupplementaryHistoryItemType[],
        });
      }
    } catch (error) {
      logger.error("Failed to fetch supplementary history", error);
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
