import { AdminAccountsService } from "@webcampus/api/src/services/admin/accounts.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class AdminAccountsController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdminAccountsService.create(
        {
          email: req.body.email,
          username: req.body.username,
          password: req.body.password,
          name: req.body.name,
          role: "accounts",
        },
        req.headers,
        req.file,
        req.body.photo
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error creating Accounts user:", err);
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
      const response = await AdminAccountsService.update(
        id,
        req.body,
        req.headers,
        req.file
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error updating Accounts user:", err);
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
      const response = await AdminAccountsService.getAll();

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error fetching Accounts users:", err);
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
      const response = await AdminAccountsService.delete(id);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error deleting Accounts user:", err);
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
