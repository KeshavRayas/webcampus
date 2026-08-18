import { FacultyAttendanceWindowService } from "@webcampus/api/src/services/faculty/faculty-attendance-window.service";
import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
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

  if (error.message.toLowerCase().includes("forbidden")) {
    return 403;
  }

  return 500;
};

export class FacultyAttendanceWindowController {
  static async getSections(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = req.requestContext;
      if (!requestContext?.userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const query = req.query as { semesterId: string };
      const sections = await FacultyAttendanceWindowService.getSections(
        requestContext.userId,
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
      const requestContext = req.requestContext;
      if (!requestContext?.userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const query = req.query as { academicTermId: string; semesterId: string };
      const response = await FacultyAttendanceWindowService.getWindows(
        requestContext.userId,
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
      logger.error("Error fetching faculty attendance windows", error);
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
      const requestContext = req.requestContext;
      if (!requestContext?.userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const params = req.params as {
        courseAssignmentId?: string;
        electiveBatchFacultyId?: string;
      };
      const response = await FacultyAttendanceWindowService.freezeAssignment(
        requestContext.userId,
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
      logger.error("Error freezing faculty attendance window", error);
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
      const requestContext = req.requestContext;
      if (!requestContext?.userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const payload = req.body as {
        academicTermId: string;
        semesterId: string;
      };
      const response = await FacultyAttendanceWindowService.bulkFreeze(
        requestContext.userId,
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
      logger.error("Error bulk freezing faculty attendance windows", error);
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
