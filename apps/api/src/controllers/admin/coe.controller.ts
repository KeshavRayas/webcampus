import { CoeService } from "@webcampus/api/src/services/admin/coe.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";
import { generateFileName, uploadToS3 } from "../../utils/s3";

export class CoeController {
  static async createCoe(req: Request, res: Response): Promise<void> {
    try {
      if (req.file) {
        const fileName = generateFileName(req.file.originalname, "coe/photos/");
        const s3Result = await uploadToS3(
          req.file.buffer,
          fileName,
          req.file.mimetype
        );

        if (s3Result.success) {
          req.body.photo = s3Result.url;
        } else {
          // FIX 1: Added required 'error' property
          return sendResponse({
            res,
            status: "error",
            message: "Failed to upload profile photo",
            statusCode: 500,
            error: new Error("S3 upload failed"),
          });
        }
      }

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
      // FIX 2: Wrapped in String() to ensure it's not undefined or string[]
      const id = String(req.params.id);

      if (req.file) {
        const fileName = generateFileName(req.file.originalname, "coe/photos/");
        const s3Result = await uploadToS3(
          req.file.buffer,
          fileName,
          req.file.mimetype
        );

        if (s3Result.success) {
          req.body.photo = s3Result.url;
        }
      }

      const response = await CoeService.update(id, req.body);

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
        message: err.message || "Failed to update COE user",
        statusCode: 500,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  static async updateCoe(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
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
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error updating COE: ${error.message}`, error);
        sendResponse({
          res,
          status: "error",
          message: error.message,
          statusCode: error.message.includes("exists") ? 409 : 400,
          error,
        });
      } else {
        logger.error(
          `Error updating COE: ${ERRORS.INTERNAL_SERVER_ERROR}`,
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error creating COE: ${err.message}`, err);
      sendResponse({
        res,
        status: "error",
        message: "Failed to get COEs",
        statusCode: 500,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  static async deleteCoe(req: Request, res: Response): Promise<void> {
    try {
      // FIX 2: Wrapped in String() here as well
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
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
