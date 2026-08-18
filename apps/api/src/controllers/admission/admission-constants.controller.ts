import { AdmissionConstantsService } from "@webcampus/api/src/services/admission/admission-constants.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

function sendConflictMessage(res: Response, message: string): void {
  sendResponse({
    res,
    status: "error",
    statusCode: 409,
    message,
    error: message,
  });
}

export class AdmissionConstantsController {
  static async getOptions(_req: Request, res: Response): Promise<void> {
    try {
      const data = await AdmissionConstantsService.getOptions();

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Admission constants fetched successfully",
        data,
      });
    } catch (error) {
      logger.error("Error fetching admission constants options", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const data = await AdmissionConstantsService.getAll();

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Admission constants fetched successfully",
        data,
      });
    } catch (error) {
      logger.error("Error fetching admission constants", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async createMode(req: Request, res: Response): Promise<void> {
    try {
      await AdmissionConstantsService.createMode(req.body);

      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: "Admission mode created successfully",
        data: null,
      });
    } catch (error) {
      logger.error("Error creating admission mode", error);
      sendConflictMessage(
        res,
        (error as Error).message ?? "Failed to create admission mode"
      );
    }
  }

  static async updateMode(req: Request, res: Response): Promise<void> {
    try {
      const { mode } = req.params;
      await AdmissionConstantsService.updateMode(mode as string, req.body);

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Admission mode updated successfully",
        data: null,
      });
    } catch (error) {
      logger.error("Error updating admission mode", error);
      sendConflictMessage(
        res,
        (error as Error).message ?? "Failed to update admission mode"
      );
    }
  }

  static async deleteMode(req: Request, res: Response): Promise<void> {
    try {
      const { mode } = req.params;
      await AdmissionConstantsService.deleteMode(mode as string);

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Admission mode deleted successfully",
        data: null,
      });
    } catch (error) {
      logger.error("Error deleting admission mode", error);
      sendConflictMessage(
        res,
        (error as Error).message ?? "Failed to delete admission mode"
      );
    }
  }
}
