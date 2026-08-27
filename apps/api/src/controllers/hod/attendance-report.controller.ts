import { auth } from "@webcampus/auth";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import { HODAttendanceReportService } from "../../services/hod/attendance-report.service";

interface QueryParams {
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
  cycle?: string;
  batchId?: string;
}

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 401;
  if (
    error.message.startsWith("Missing ") ||
    error.message.includes("required")
  )
    return 400;
  if (
    error.message.includes("not found") ||
    error.message === "HOD profile not found or department not assigned"
  )
    return 404;
  return 500;
};

export class HODAttendanceReportController {
  private static async getUserId(req: Request): Promise<string> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
  }

  static async getFilterOptions(req: Request, res: Response): Promise<void> {
    try {
      const response = await HODAttendanceReportService.getFilterOptions(
        await HODAttendanceReportController.getUserId(req)
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getFilterOptions):", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch filter options",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  static async getCourses(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId, cycle } = req.query as QueryParams;
      if (!semesterId) throw new Error("Missing semesterId");

      const response = await HODAttendanceReportService.getCourses(
        await HODAttendanceReportController.getUserId(req),
        semesterId,
        cycle
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getCourses):", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : "Failed to fetch courses",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  static async getSections(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId, courseId, cycle } = req.query as QueryParams;
      if (!semesterId || !courseId)
        throw new Error("Missing semesterId or courseId");

      const response = await HODAttendanceReportService.getSections(
        await HODAttendanceReportController.getUserId(req),
        semesterId,
        courseId,
        cycle
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getSections):", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : "Failed to fetch sections",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  static async getDetailedReport(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, sectionId, batchId } = req.query as QueryParams;
      if (!courseId || !sectionId)
        throw new Error("Missing courseId or sectionId");

      const response = await HODAttendanceReportService.getDetailedReport(
        await HODAttendanceReportController.getUserId(req),
        courseId,
        sectionId,
        batchId
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getDetailedReport):", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch detailed report",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
