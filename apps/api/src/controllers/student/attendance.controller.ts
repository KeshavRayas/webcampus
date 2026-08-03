import { SemesterService } from "@webcampus/api/src/services/admin/semester.service";
import { StudentAttendanceService } from "@webcampus/api/src/services/student/attendance.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { AcademicTermQueryType } from "@webcampus/schemas/admin";
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

const getStatusCodeForError = (message: string): number => {
  if (message === ERRORS.UNAUTHENTICATED || message === ERRORS.UNAUTHORIZED) {
    return 401;
  }
  if (message.toLowerCase().includes("not found")) {
    return 404;
  }
  return 400;
};

export class StudentAttendanceController {
  /**
   * GET /terms
   * Returns academic terms with semesters, reusing the admin service safely.
   * Structurally identical to the faculty terms endpoint.
   */
  static async getAcademicTerms(req: Request, res: Response): Promise<void> {
    try {
      await resolveSessionUser(req);
      const query = req.query as AcademicTermQueryType;

      const response = await SemesterService.getAllAcademicTerms(query);

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
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching academic terms for student", {
        error,
        path: req.path,
      });

      sendResponse({
        res,
        status: "error",
        message: errorMessage,
        statusCode: getStatusCodeForError(errorMessage),
        error,
      });
    }
  }

  static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { semesterId } = req.query;

      const response =
        await StudentAttendanceService.getStudentAttendanceSummary(
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

      const errorMessage =
        response.message || "Failed to fetch attendance summary";
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
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getCourseDetails(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { courseId } = req.params;

      const response =
        await StudentAttendanceService.getStudentCourseAttendanceDetails(
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

      const errorMessage =
        response.message || "Failed to fetch course attendance details";
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message: errorMessage,
        error: new Error(errorMessage), // Added required error field
      });
    } catch (error) {
      logger.error(
        "Error in student course attendance details controller",
        error
      );
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
