import { RegistrationWindowService } from "@webcampus/api/src/services/admin/registration-window.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  CreateRegistrationWindowType,
  GetRegistrationWindowsQueryType,
  RegistrationWindowCoursesParamsType,
  ToggleRegistrationWindowBodyType,
  ToggleRegistrationWindowParamsType,
} from "@webcampus/schemas/admin";
import type { Request, Response } from "express";

export class RegistrationWindowController {
  private static getStatusCode(error: unknown): number {
    if (!(error instanceof Error)) {
      return 500;
    }

    if (
      error.message === "Semester not found" ||
      error.message === "Department not found" ||
      error.message === "Registration window not found"
    ) {
      return 404;
    }

    if (
      error.message ===
        "Semester does not belong to the selected academic term" ||
      error.message.includes("can only be set") ||
      error.message.includes("cannot be set") ||
      error.message.includes("Select either")
    ) {
      return 400;
    }

    return 500;
  }

  static async getWindows(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as GetRegistrationWindowsQueryType;
      const response = await RegistrationWindowService.getWindows(query);

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
      logger.error("Error fetching registration windows", error);
      sendResponse({
        res,
        status: "error",
        statusCode: RegistrationWindowController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async createWindow(req: Request, res: Response): Promise<void> {
    try {
      const payload: CreateRegistrationWindowType = req.body;
      const response = await RegistrationWindowService.createWindow(payload);

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
      logger.error("Error creating registration window", error);
      sendResponse({
        res,
        status: "error",
        statusCode: RegistrationWindowController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async toggleWindow(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as ToggleRegistrationWindowParamsType;
      const body: ToggleRegistrationWindowBodyType = req.body;

      const response = await RegistrationWindowService.toggleWindow(
        params.id,
        body.isOpen
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
      logger.error("Error toggling registration window", error);
      sendResponse({
        res,
        status: "error",
        statusCode: RegistrationWindowController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getApprovedCourses(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as RegistrationWindowCoursesParamsType;
      const response =
        await RegistrationWindowService.getApprovedCoursesByWindow(params.id);

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
      logger.error("Error fetching approved courses", error);
      sendResponse({
        res,
        status: "error",
        statusCode: RegistrationWindowController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
