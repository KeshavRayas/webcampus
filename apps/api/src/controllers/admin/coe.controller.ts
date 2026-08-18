import { CoeService } from "@webcampus/api/src/services/admin/coe.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class CoeController {
  static async createCoe(req: Request, res: Response): Promise<void> {
    try {
      const response = await CoeService.create({
        ...req.body,
        headers: req.headers,
        photoFile: req.file,
      });

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
      logger.error(`Error creating COE: ${err.message}`, err);
      sendResponse({
        res,
        status: "error",
        message: err.message || ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: err.message?.includes("exists") ? 409 : 500,
        error: error instanceof Error ? error : new Error(String(error)), // FIX 1: Passed the error object
      });
    }
  }

  static async updateCoe(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const response = await CoeService.update(id, req.body, req.file);

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
      logger.error(`Error updating COE: ${err.message}`, err);
      sendResponse({
        res,
        status: "error",
        message: err.message || "Failed to update COE user",
        statusCode: err.message.includes("exists") ? 409 : 500,
        error: err,
      });
    }
  }

  static async getCoes(req: Request, res: Response): Promise<void> {
    try {
      const response = await CoeService.getCoes();

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
      logger.error(`Error fetching COEs: ${err.message}`, err);
      sendResponse({
        res,
        status: "error",
        message: "Failed to get COEs",
        statusCode: 500,
        error: err,
      });
    }
  }

  static async deleteCoe(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const response = await CoeService.delete(id);

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
      logger.error(`Error creating COE: ${err.message}`, err);
      sendResponse({
        res,
        status: "error",
        message: err.message || "Failed to delete COE",
        statusCode: 500,
        error: err,
      });
    }
  }
}
