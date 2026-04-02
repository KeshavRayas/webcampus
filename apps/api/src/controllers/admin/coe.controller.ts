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
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error creating COE: ${error.message}`, error);
        sendResponse({
          res,
          status: "error",
          message: error.message,
          statusCode: error.message.includes("exists") ? 409 : 500,
          error,
        });
      } else {
        logger.error(
          `Error creating COE: ${ERRORS.INTERNAL_SERVER_ERROR}`,
          error
        );
        sendResponse({
          res,
          status: "error",
          message: ERRORS.INTERNAL_SERVER_ERROR,
          statusCode: 500,
          error,
        });
      }
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
    } catch (error) {
      logger.error(`Failed to get COEs`, error);
      sendResponse({
        res,
        status: "error",
        message: "Failed to get COEs",
        statusCode: 500,
        error,
      });
    }
  }

  static async deleteCoe(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
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
    } catch (error) {
      logger.error(`Failed to delete COE`, error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete COE",
        statusCode: 500,
        error,
      });
    }
  }
}
