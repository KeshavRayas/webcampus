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
        await this.getUserId(req)
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getFilterOptions):", error);
      sendResponse({
        res,
        status: "error",
        statusCode: 500,
        message: "Failed",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  static async getCourses(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId, cycle } = req.query as QueryParams;
      if (!semesterId) throw new Error("Missing semesterId");

      const response = await HODAttendanceReportService.getCourses(
        await this.getUserId(req),
        semesterId,
        cycle
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getCourses):", error);
      sendResponse({
        res,
        status: "error",
        statusCode: 500,
        message: "Failed",
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
        await this.getUserId(req),
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
        statusCode: 500,
        message: "Failed",
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
        await this.getUserId(req),
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
        statusCode: 500,
        message: "Failed",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
