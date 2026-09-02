import { PromotionService } from "@webcampus/api/src/services/admin/promotion.service";
import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";

export class PromotionController {
  private static getStatusCode(error: unknown): number {
    if (!(error instanceof Error)) return 500;
    if (error.message.includes("not found")) return 404;
    if (
      error.message.includes("must") ||
      error.message.includes("not enrolled") ||
      error.message.includes("Already promoted")
    ) {
      return 400;
    }
    return 500;
  }

  static async getCandidates(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as unknown as {
        fromSemesterId: string;
        toSemesterId: string;
      };
      const response = await PromotionService.getCandidates(query);

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
      logger.error("Error fetching promotion candidates:", error);
      sendResponse({
        res,
        status: "error",
        statusCode: PromotionController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async promoteStudents(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: "Unauthorized",
          error: new Error("Unauthorized"),
        });
        return;
      }

      const response = await PromotionService.promoteStudents(
        req.body,
        session.user.id
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
      logger.error("Error promoting students:", error);
      sendResponse({
        res,
        status: "error",
        statusCode: PromotionController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as unknown as {
        academicTermId?: string;
        studentId?: string;
        page: number;
        pageSize: number;
      };
      const response = await PromotionService.getHistory(query);

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
      logger.error("Error fetching promotion history:", error);
      sendResponse({
        res,
        status: "error",
        statusCode: PromotionController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
