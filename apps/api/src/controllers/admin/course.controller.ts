import { AdminCourseService } from "@webcampus/api/src/services/admin/course.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { AdminCourseBranchQueryType } from "@webcampus/schemas/admin";
import type { UUIDType } from "@webcampus/schemas/common";
import type {
  CreateCourseDTO,
  DeleteCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import type { Request, Response } from "express";

export class AdminCourseController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateCourseDTO = req.body;
      const response = await AdminCourseService.create(request);

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error creating admin course", error);
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

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const request: UpdateCourseDTO = req.body;
      const response = await AdminCourseService.update(request);

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error updating admin course", error);
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

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const request: DeleteCourseDTO = req.body;
      const response = await AdminCourseService.delete(request.id);

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error deleting admin course", error);
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

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const request = req.params as UUIDType;
      const response = await AdminCourseService.getById(request.id);

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error fetching admin course", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 404 : 500,
        error,
      });
    }
  }

  static async getByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { departmentName, semesterId, cycle } =
        req.query as AdminCourseBranchQueryType;
      const response = await AdminCourseService.getByDepartment(
        departmentName,
        semesterId,
        cycle
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error fetching admin courses by department", error);
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
