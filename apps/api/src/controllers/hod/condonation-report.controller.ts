import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import { HODCondonationReportService } from "../../services/hod/condonation-report.service";

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (
    error.message.includes("not found") ||
    error.message === "HOD profile not found or department not assigned"
  ) {
    return 404;
  }
  if (error.message.includes("your department")) return 404;
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

export class HODCondonationReportController {
  static async getCondonedReport(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      // Extract filters from query parameters
      const filters = {
        semesterId: req.query.semesterId as string,
        courseId: req.query.courseId as string,
        sectionId: req.query.sectionId as string | undefined,
        cycle: req.query.cycle as string | undefined,
      };

      if (!filters.semesterId || !filters.courseId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: "Semester ID and course ID are required",
          error: new Error("Semester ID and course ID are required"),
        });
        return;
      }

      const response = await HODCondonationReportService.getCondonedReport(
        session.user.id,
        filters
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
      logger.error("Error generating condonation report", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        // ADD THIS LINE TO SATISFY THE TYPE CHECKER:
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
