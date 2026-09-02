import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type {
  AssignReRegistrationStudentsType,
  CreateReRegistrationOfferingType,
  GetReRegistrationOfferingsQueryType,
} from "@webcampus/schemas/admin";
import type { Request, Response } from "express";
import { ReRegistrationOfferingService } from "../../services/admin/re-registration-offering.service";

export class ReRegistrationOfferingController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const response = await ReRegistrationOfferingService.createOffering(
        req.body as CreateReRegistrationOfferingType
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
      logger.error("Create re-registration offering failed", { error });
      sendResponse({
        res,
        status: "error",
        statusCode: ReRegistrationOfferingController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async assignStudents(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id?: string };
      const response = await ReRegistrationOfferingService.assignStudents(
        id as string,
        req.body as AssignReRegistrationStudentsType
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
      logger.error("Assign re-registration students failed", { error });
      sendResponse({
        res,
        status: "error",
        statusCode: ReRegistrationOfferingController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as unknown as GetReRegistrationOfferingsQueryType;
      const response = await ReRegistrationOfferingService.getOfferings(query);
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
      logger.error("List re-registration offerings failed", { error });
      sendResponse({
        res,
        status: "error",
        statusCode: ReRegistrationOfferingController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  private static getStatusCode(error: unknown): number {
    if (!(error instanceof Error)) return 500;
    const message = error.message.toLowerCase();
    if (message.includes("not found")) return 404;
    return 400;
  }
}
