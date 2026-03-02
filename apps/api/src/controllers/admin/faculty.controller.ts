import { AdminFacultyService } from "@webcampus/api/src/services/admin/faculty.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { CreateUserType } from "@webcampus/schemas/admin";
import { CreateFacultyType } from "@webcampus/schemas/faculty";
import { Request, Response } from "express";

export class AdminFacultyController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as CreateFacultyType & CreateUserType;

      const response = await AdminFacultyService.create({
        ...request,
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
      logger.error("Error Creating Faculty", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async getByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const departmentId = req.params.departmentId as string;
      const response =
        await AdminFacultyService.getByDepartmentId(departmentId);

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
      logger.error("Error Fetching Faculty", error);
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
