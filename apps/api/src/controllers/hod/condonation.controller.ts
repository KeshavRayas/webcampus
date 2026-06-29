import { HODCondonationService } from "@webcampus/api/src/services/hod/condonation.service";
import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type {
  HODCondonationAttendanceId,
  HODCondonationFilters,
} from "@webcampus/schemas/hod";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (
    error.message.includes("not found") ||
    error.message === "HOD profile not found or department not assigned"
  )
    return 404;
  if (
    error.message.includes("not eligible") ||
    error.message.includes("already been approved")
  )
    return 409;
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

export class HODCondonationController {
  static async getStudents(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const query = req.query as unknown as HODCondonationFilters;
      const response = await HODCondonationService.getStudents(
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
      logger.error("Error fetching condonation students", error);
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

  static async getCourses(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const query = req.query as { semesterId?: string };
      const courses = await HODCondonationService.getCourses(
        session.user.id,
        query.semesterId
      );

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Courses fetched successfully",
        data: courses,
      });
    } catch (error) {
      logger.error("Error fetching courses", error);
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

  static async approveCondonation(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const params = req.params as HODCondonationAttendanceId;
      const response = await HODCondonationService.approveCondonation(
        session.user.id,
        params.attendanceId
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
      logger.error("Error approving condonation", error);
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
