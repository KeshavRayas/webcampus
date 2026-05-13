import { HODAttendanceWindowService } from "@webcampus/api/src/services/hod/attendance-window.service";
import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type {
  HODAttendanceWindowFilters,
  HODBulkFreeze,
  HODBulkUnfreeze,
  HODFreezeParams,
  HODUnfreezeParams,
} from "@webcampus/schemas/hod";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (
    error.message.includes("not found") ||
    error.message === "Semester not found" ||
    error.message === "HOD profile not found or department not assigned"
  )
    return 404;
  if (
    error.message.includes("Semester does not belong") ||
    error.message === "Academic Term is not current"
  )
    return 400;
  return 500;
};

const requireSession = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session?.user?.id) {
    sendResponse({
      res,
      status: "error",
      statusCode: 401,
      message: ERRORS.UNAUTHORIZED,
      error: ERRORS.UNAUTHORIZED,
    });
    return null;
  }
  return session;
};

export class HODAttendanceWindowController {
  static async getSections(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const query = req.query as { semesterId?: string };
      const sections = await HODAttendanceWindowService.getSections(
        session.user.id,
        query.semesterId
      );

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Sections fetched successfully",
        data: sections,
      });
    } catch (error) {
      logger.error("Error fetching sections", error);
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

  static async getWindows(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const query = req.query as unknown as HODAttendanceWindowFilters;
      const response = await HODAttendanceWindowService.getWindows(
        session.user.id,
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

  static async freezeAssignment(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const params = req.params as HODFreezeParams;
      const response = await HODAttendanceWindowService.freezeAssignment(
        session.user.id,
        params.courseAssignmentId,
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
      logger.error("Error closing attendance window", error);
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

  static async unfreezeAssignment(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const params = req.params as HODUnfreezeParams;
      const response = await HODAttendanceWindowService.unfreezeAssignment(
        session.user.id,
        params.courseAssignmentId
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

  static async bulkFreeze(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const payload = req.body as HODBulkFreeze;
      const response = await HODAttendanceWindowService.bulkFreeze(
        session.user.id,
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
      const session = await requireSession(req, res);
      if (!session) return;

      const payload = req.body as HODBulkUnfreeze;
      const response = await HODAttendanceWindowService.bulkUnfreeze(
        session.user.id,
        payload
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
}
