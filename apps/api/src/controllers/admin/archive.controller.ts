import { ArchiveService } from "@webcampus/api/src/services/admin/archive.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { ArchiveSemesterQueryType } from "@webcampus/schemas/admin";
import { Request, Response } from "express";

export class ArchiveController {
  static async getArchiveSummary(req: Request, res: Response): Promise<void> {
    try {
      const semesterId = req.params.id as string;
      const response = await ArchiveService.getArchiveSummary(semesterId);

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
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getAllArchives(req: Request, res: Response): Promise<void> {
    try {
      const query: ArchiveSemesterQueryType = req.query;
      const response = await ArchiveService.getAllArchives(query);

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
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
