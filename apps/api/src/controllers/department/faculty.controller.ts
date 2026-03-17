import { DepartmentFacultyService } from "@webcampus/api/src/services/department/faculty.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { DepartmentFacultyQueryType } from "@webcampus/schemas/department";
import { Request, Response } from "express";

export class DepartmentFacultyController {
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const response = await DepartmentFacultyService.getAll(
        req.headers,
        req.query as DepartmentFacultyQueryType
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
    } catch (error) {
      logger.error("Error Fetching Department Faculty", error);

      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      let statusCode = 500;

      if (errorMessage === "Unauthorized") {
        statusCode = 401;
      }

      if (errorMessage === "Department not found for this user") {
        statusCode = 404;
      }

      sendResponse({
        res,
        status: "error",
        message: errorMessage,
        statusCode,
        error,
      });
    }
  }
}
