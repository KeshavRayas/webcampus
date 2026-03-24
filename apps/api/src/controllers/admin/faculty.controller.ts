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

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const request = req.body;
      const response = await AdminFacultyService.update(id, request);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      }
    } catch (error) {
      logger.error("Error Updating Faculty", error);
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

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const response = await AdminFacultyService.delete(id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      }
    } catch (error) {
      logger.error("Error Deleting Faculty", error);
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

  static async createHodAccount(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const request = req.body;
      const response = await AdminFacultyService.createHodAccount(
        id,
        request.departmentId,
        { ...request, headers: req.headers }
      );
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 201,
        });
      }
    } catch (error) {
      logger.error("Error Creating HOD Account", error);
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

  static async reassignHodAccount(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { hodId } = req.body;
      const response = await AdminFacultyService.reassignHodAccount(hodId, id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      }
    } catch (error) {
      logger.error("Error Reassigning HOD Account", error);
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
}
