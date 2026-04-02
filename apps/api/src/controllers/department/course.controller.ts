import { CourseService } from "@webcampus/api/src/services/department/course.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { UUIDType } from "@webcampus/schemas/common";
import {
  CreateCourseDTO,
  DeleteCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import { Request, Response } from "express";

export class CourseController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateCourseDTO = req.body;
      logger.debug("Creating Course", request);
      const response = await CourseService.create(request);
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
      logger.error("Error Creating Course", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const request: UpdateCourseDTO = req.body;
      logger.debug("Updating Course", request);
      const response = await CourseService.update(request);
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
      logger.error("Error Updating Course", error);
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
      logger.debug("Deleting Course", request);
      const response = await CourseService.delete(request.id);
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
      logger.error("Error Deleting Course", error);
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
      const response = await CourseService.getById(request.id);
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
      const message = error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const statusCode = message === "Course not found" ? 404 : 500;
      
      logger.error("Error Fetching Course", error);
      sendResponse({
        res,
        status: "error",
        message,
        statusCode,
        error,
      });
    }
  }

  static async getByBranch(req: Request, res: Response): Promise<void> {
    try {
      const { name, semesterId } = req.query as {
        name: string;
        semesterId?: string;
      };

      const response = await CourseService.getByBranch(name, semesterId);

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
      logger.error("Error Fetching Courses by Branch", error);
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
