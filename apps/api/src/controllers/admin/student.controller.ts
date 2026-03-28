import { AdminStudentService } from "@webcampus/api/src/services/admin/student.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  GetAdminStudentsQuerySchema,
  GetAdminStudentsQueryType,
} from "@webcampus/schemas/admin";
import { Request, Response } from "express";

export class AdminStudentController {
  static async getById(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const response = await AdminStudentService.getById(req.params.id);

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
      logger.error("Error fetching admin student details", error);

      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const statusCode = errorMessage.includes("not found") ? 404 : 500;

      sendResponse({
        res,
        status: "error",
        message: errorMessage,
        statusCode,
        error,
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      // Parse through Zod to ensure coercion (string "1" → number 1)
      const parseResult = GetAdminStudentsQuerySchema.safeParse(req.query);
      const query: GetAdminStudentsQueryType = parseResult.success
        ? parseResult.data
        : (req.query as GetAdminStudentsQueryType);

      const response = await AdminStudentService.getAll(query);

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
      logger.error("Error fetching admin students", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async delete(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const response = await AdminStudentService.deleteStudent(req.params.id);

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
      logger.error("Error deleting student", error);

      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const statusCode = errorMessage.includes("not found") ? 404 : 500;

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
