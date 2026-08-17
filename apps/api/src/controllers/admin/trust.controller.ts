import { AdminTrustService } from "@webcampus/api/src/services/admin/trust.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class AdminTrustController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdminTrustService.create(
        {
          email: req.body.email,
          username: req.body.username,
          password: req.body.password,
          name: req.body.name,
          role: "trust",
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
      logger.error("Error creating Trust user:", err);
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
      const response = await AdminTrustService.update(
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
      logger.error("Error updating Trust user:", err);
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
      const response = await AdminTrustService.getAll();

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
      logger.error("Error fetching Trust users:", err);
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
      const response = await AdminTrustService.delete(id);

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
      logger.error("Error deleting Trust user:", err);
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
