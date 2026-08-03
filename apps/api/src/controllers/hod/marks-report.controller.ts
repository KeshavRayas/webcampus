import { auth } from "@webcampus/auth";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Cycle } from "@webcampus/db";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import { HODMarksReportService } from "../../services/hod/marks-report.service";

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 401;
  if (
    error.message.includes("not found") ||
    error.message === "HOD profile not found or department not assigned"
  ) {
    return 404;
  }
  if (error.message.includes("your department")) return 404;
  return 500;
};

export class HODMarksReportController {
  private static async getUserId(req: Request): Promise<string> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
  }

  static async getFilterOptions(req: Request, res: Response) {
    try {
      const response = await HODMarksReportService.getFilterOptions(
        await HODMarksReportController.getUserId(req)
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getFilterOptions):", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch filter options",
        statusCode: getStatusCode(error),
        error,
      });
    }
  }

  static async getCourses(req: Request, res: Response) {
    try {
      const { semesterId, cycle } = req.query as {
        semesterId: string;
        cycle?: string;
      };
      if (!semesterId) throw new Error("Missing semesterId");
      const response = await HODMarksReportService.getCourses(
        await HODMarksReportController.getUserId(req),
        semesterId,
        cycle
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getCourses):", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch courses",
        statusCode: getStatusCode(error),
        error,
      });
    }
  }

  static async getSections(req: Request, res: Response) {
    try {
      const { semesterId, courseId, cycle } = req.query as {
        semesterId: string;
        courseId: string;
        cycle?: string;
      };
      if (!semesterId || !courseId) {
        throw new Error("Missing semesterId or courseId");
      }
      const response = await HODMarksReportService.getSections(
        await HODMarksReportController.getUserId(req),
        semesterId,
        courseId,
        cycle as Cycle
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getSections):", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch sections",
        statusCode: getStatusCode(error),
        error,
      });
    }
  }

  static async getAssessments(req: Request, res: Response) {
    try {
      const { courseId } = req.query as { courseId: string };
      if (!courseId) throw new Error("Missing courseId");
      const response = await HODMarksReportService.getAssessments(
        await HODMarksReportController.getUserId(req),
        courseId
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getAssessments):", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch assessments",
        statusCode: getStatusCode(error),
        error,
      });
    }
  }

  static async getMarksReport(req: Request, res: Response) {
    try {
      const { courseId, sectionId, assessmentId } = req.query as {
        courseId: string;
        sectionId: string;
        assessmentId?: string;
      };
      if (!courseId || !sectionId) {
        throw new Error("Missing courseId or sectionId");
      }
      const response = await HODMarksReportService.getMarksReport(
        await HODMarksReportController.getUserId(req),
        courseId,
        sectionId,
        assessmentId
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      logger.error("Controller Error (getMarksReport):", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch marks report",
        statusCode: getStatusCode(error),
        error,
      });
    }
  }
}
