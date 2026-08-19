import { AccountsService } from "@webcampus/api/src/services/accounts/accounts.service";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { Request, Response } from "express";

export class AccountsController {
  static async search(req: Request, res: Response) {
    try {
      const response = await AccountsService.searchStudents(req.query as never);
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
      const response = await AccountsService.getStudent(
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
      const response = await AccountsService.saveFee(
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

  static async addPayment(req: Request<{ accountsId: string }>, res: Response) {
    try {
      const response = await AccountsService.addPayment(
        req.params.accountsId,
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
        : "Unable to process accounts request";
    logger.error("Accounts request failed", error);
    sendResponse({
      res,
      status: "error",
      statusCode: message.includes("not found") ? 404 : 500,
      message,
      error,
    });
  }
}
