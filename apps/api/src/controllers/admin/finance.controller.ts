import { AdminFinanceService } from "@webcampus/api/src/services/admin/finance.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class AdminFinanceController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdminFinanceService.create(
        {
          email: req.body.email,
          username: req.body.username,
          password: req.body.password,
          name: req.body.name,
        },
        req.headers,
        req.file,
        req.body.photo
      );

      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: response.message,
        data: response.data,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error creating Finance user:", err);
      sendResponse({
        res,
        status: "error",
        message: err.message || ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error: err,
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const response = await AdminFinanceService.update(
        id,
        req.body,
        req.file
      );

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error updating Finance user:", err);
      sendResponse({
        res,
        status: "error",
        message: err.message || ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error: err,
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdminFinanceService.getAll();
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error fetching Finance users:", err);
      sendResponse({
        res,
        status: "error",
        message: err.message || ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error: err,
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const response = await AdminFinanceService.delete(id);
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error deleting Finance user:", err);
      sendResponse({
        res,
        status: "error",
        message: err.message || ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error: err,
      });
    }
  }
}
