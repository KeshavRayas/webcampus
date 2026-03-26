import { DepartmentStudentService } from "@webcampus/api/src/services/department/student.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  DepartmentStudentQuerySchema,
  DepartmentStudentQueryType,
} from "@webcampus/schemas/department";
import { Request, Response } from "express";

export class DepartmentStudentController {
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      // Parse through Zod to ensure coercion (string "1" → number 1)
      const parseResult = DepartmentStudentQuerySchema.safeParse(req.query);
      const query: DepartmentStudentQueryType = parseResult.success
        ? parseResult.data
        : (req.query as DepartmentStudentQueryType);

      const response = await DepartmentStudentService.getAll(
        req.headers,
        query
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
      logger.error("Error Fetching Department Students", error);

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
