import { StudentAttendanceService } from "@webcampus/api/src/services/student/attendance.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { Request, Response } from "express";

const resolveSessionUser = async (req: Request) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) {
    throw new Error(ERRORS.UNAUTHENTICATED);
  }

  return session.user;
};

export class StudentAttendanceController {
  static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { semesterId } = req.query;

      const response = await StudentAttendanceService.getStudentAttendanceSummary(
        user.id,
        semesterId as string
      );

      if (response.status === "success" && "data" in response) {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
        return;
      }

      const errorMessage = response.message || "Failed to fetch attendance summary";
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message: errorMessage,
        error: new Error(errorMessage), // Added required error field
      });
    } catch (error) {
      logger.error("Error in student attendance summary controller", error);
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getCourseDetails(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { courseId } = req.params;

      const response = await StudentAttendanceService.getStudentCourseAttendanceDetails(
        user.id,
        courseId as string
      );

      if (response.status === "success" && "data" in response) {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
        return;
      }

      const errorMessage = response.message || "Failed to fetch course attendance details";
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message: errorMessage,
        error: new Error(errorMessage), // Added required error field
      });
    } catch (error) {
      logger.error("Error in student course attendance details controller", error);
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}