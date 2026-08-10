import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  CreateBonusAttendanceWindowType,
  GetBonusAttendanceWindowsQueryType,
  ToggleBonusAttendanceWindowBodyType,
  ToggleBonusAttendanceWindowParamsType,
  UpdateBonusAttendanceWindowBodyType,
  UpdateBonusAttendanceWindowParamsType,
} from "@webcampus/schemas/admin";
import type { Request, Response } from "express";
import { BonusAttendanceWindowService } from "../../services/admin/bonus-attendance.service";

export class BonusAttendanceWindowController {
  static async getWindows(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as unknown as GetBonusAttendanceWindowsQueryType;
      const response = await BonusAttendanceWindowService.getWindows(query);

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
      logger.error("Error fetching bonus attendance windows:", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async createWindow(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as CreateBonusAttendanceWindowType;
      const response = await BonusAttendanceWindowService.createWindow(payload);

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
      logger.error("Error creating bonus attendance window:", error);
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

  static async toggleWindow(req: Request, res: Response): Promise<void> {
    try {
      const params =
        req.params as unknown as ToggleBonusAttendanceWindowParamsType;
      const body = req.body as ToggleBonusAttendanceWindowBodyType;

      const response = await BonusAttendanceWindowService.toggleWindow(
        params.id,
        body.isOpen
      );

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
      logger.error("Error toggling bonus attendance window:", error);
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

  static async updateWindow(req: Request, res: Response): Promise<void> {
    try {
      const params =
        req.params as unknown as UpdateBonusAttendanceWindowParamsType;
      const body = req.body as UpdateBonusAttendanceWindowBodyType;

      const response = await BonusAttendanceWindowService.updateWindow(
        params.id,
        body.days
      );

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
      logger.error("Error updating bonus attendance window:", error);
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
