import { AttendanceWindowService } from "@webcampus/api/src/services/admin/attendance-window.service";
import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type {
  AdminAttendanceWindowFilters,
  AdminBulkFreeze,
  AdminBulkUnfreeze,
  AdminFreezeParams,
  AdminUnfreezeParams,
} from "@webcampus/schemas/admin";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message === "Semester not found" ||
    error.message === "Academic Term not found" ||
    error.message === "Course assignment not found" ||
    error.message === "Elective batch faculty assignment not found"
  ) {
    return 404;
  }

  if (
    error.message ===
      "Semester does not belong to the selected academic term" ||
    error.message === "Academic Term is not current"
  ) {
    return 400;
  }

  return 500;
};

export class AttendanceWindowController {
  static async getWindows(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as AdminAttendanceWindowFilters;
      const response = await AttendanceWindowService.getWindows(query);

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
      logger.error("Error fetching attendance windows", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async bulkFreeze(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as AdminBulkFreeze;
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const response = await AttendanceWindowService.bulkFreeze(
        payload,
        session?.user?.username,
        session?.user?.displayUsername
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
      logger.error("Error freezing attendance windows", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async bulkUnfreeze(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as AdminBulkUnfreeze;
      const response = await AttendanceWindowService.bulkUnfreeze(payload);

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
      logger.error("Error unfreezing attendance windows", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async freezeAssignment(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as AdminFreezeParams;
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const response = await AttendanceWindowService.freezeAssignment(
        {
          courseAssignmentId: params.courseAssignmentId,
          electiveBatchFacultyId: params.electiveBatchFacultyId,
        },
        session?.user?.username,
        session?.user?.displayUsername
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
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error locking attendance window", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message: errMsg,
        error: errMsg,
      });
    }
  }

  static async unfreezeAssignment(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as AdminUnfreezeParams;
      const response = await AttendanceWindowService.unfreezeAssignment({
        courseAssignmentId: params.courseAssignmentId,
        electiveBatchFacultyId: params.electiveBatchFacultyId,
      });

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
      logger.error("Error reopening attendance window", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
