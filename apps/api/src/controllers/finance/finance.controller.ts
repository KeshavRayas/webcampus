import { FinanceService } from "@webcampus/api/src/services/finance/finance.service";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { Request, Response } from "express";

export class FinanceController {
  static async search(req: Request, res: Response) {
    try {
      const response = await FinanceService.searchStudents(req.query as never);
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  static async getStudent(req: Request<{ studentId: string }>, res: Response) {
    try {
      const academicYear =
        typeof req.query.academicYear === "string"
          ? req.query.academicYear
          : undefined;
      const response = await FinanceService.getStudent(
        req.params.studentId,
        academicYear
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  static async saveFee(req: Request<{ studentId: string }>, res: Response) {
    try {
      const response = await FinanceService.saveFee(
        req.params.studentId,
        req.body
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  static async addPayment(req: Request<{ financeId: string }>, res: Response) {
    try {
      const response = await FinanceService.addPayment(
        req.params.financeId,
        req.body
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private static handleError(res: Response, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to process finance request";
    logger.error("Finance request failed", error);
    sendResponse({
      res,
      status: "error",
      statusCode: message.includes("not found") ? 404 : 500,
      message,
      error,
    });
  }
}
