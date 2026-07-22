import {
  getByCourse,
  getByEntity,
  getChangeGroup,
} from "@webcampus/api/src/services/shared/audit.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { Request, Response } from "express";

export class AuditController {
  static async getByCourse(req: Request, res: Response): Promise<void> {
    try {
      const courseId = req.params.courseId as string;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await getByCourse(courseId, page, pageSize);

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Audit history fetched successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error fetching audit history by course", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  static async getByEntity(req: Request, res: Response): Promise<void> {
    try {
      const entityType = req.params.entityType as string;
      const entityId = req.params.entityId as string;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await getByEntity(entityType, entityId, page, pageSize);

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Audit history fetched successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error fetching audit history by entity", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  static async getChangeGroup(req: Request, res: Response): Promise<void> {
    try {
      const changeGroupId = req.params.changeGroupId as string;

      const data = await getChangeGroup(changeGroupId);

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Change group fetched successfully",
        data,
      });
    } catch (error) {
      logger.error("Error fetching change group", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }
}
