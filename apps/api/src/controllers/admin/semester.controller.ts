import { SemesterService } from "@webcampus/api/src/services/admin/semester.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  CreateSemesterType,
  SemesterQueryType,
} from "@webcampus/schemas/admin";
import { Request, Response } from "express";

export class SemesterController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateSemesterType = req.body;
      const response = await SemesterService.create(request);
      if (response.status === "success") {
        sendResponse({
          res,
          statusCode: 201,
          status: "success",
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error({ error });
      return sendResponse({
        res,
        statusCode: 500,
        status: "error",
        // message: ERRORS.INTERNAL_SERVER_ERROR,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const request: CreateSemesterType = req.body;
      const response = await SemesterService.update(
        id,
        request as CreateSemesterType
      );
      if (response.status === "success") {
        sendResponse({
          res,
          statusCode: 200,
          status: "success",
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error({ error });
      return sendResponse({
        res,
        statusCode: 400,
        status: "error",
        // message: ERRORS.INTERNAL_SERVER_ERROR,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const request: SemesterQueryType = req.query;
      const response = await SemesterService.getAll(request);
      if (response.status === "success") {
        sendResponse({
          res,
          statusCode: 200,
          status: "success",
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error({ error });
      return sendResponse({
        res,
        statusCode: 500,
        status: "error",
        // message: ERRORS.INTERNAL_SERVER_ERROR,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const response = await SemesterService.delete({ id });
      if (response.status === "success") {
        return sendResponse({
          res,
          statusCode: 200,
          status: "success",
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error({ error });
      return sendResponse({
        res,
        statusCode: 500,
        status: "error",
        // message: ERRORS.INTERNAL_SERVER_ERROR,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
