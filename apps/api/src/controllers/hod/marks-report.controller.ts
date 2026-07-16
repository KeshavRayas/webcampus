import { auth } from "@webcampus/auth";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { Cycle } from "@webcampus/db";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import { HODMarksReportService } from "../../services/hod/marks-report.service";

export class HODMarksReportController {
  private static async getUserId(req: Request) {
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
      sendResponse({
        res,
        status: "error",
        message: "Failed",
        statusCode: 500,
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
      const response = await HODMarksReportService.getCourses(
        await HODMarksReportController.getUserId(req),
        semesterId,
        cycle as Cycle
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      sendResponse({
        res,
        status: "error",
        message: "Failed",
        statusCode: 500,
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
      const response = await HODMarksReportService.getSections(
        await HODMarksReportController.getUserId(req),
        semesterId,
        courseId,
        cycle as Cycle
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      sendResponse({
        res,
        status: "error",
        message: "Failed",
        statusCode: 500,
        error,
      });
    }
  }

  static async getAssessments(req: Request, res: Response) {
    try {
      const { courseId } = req.query as { courseId: string };
      const response = await HODMarksReportService.getAssessments(courseId);
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      sendResponse({
        res,
        status: "error",
        message: "Failed",
        statusCode: 500,
        error,
      });
    }
  }

  static async getMarksReport(req: Request, res: Response) {
    try {
      const { sectionId, assessmentId } = req.query as {
        sectionId: string;
        assessmentId: string;
      };
      const response = await HODMarksReportService.getMarksReport(
        sectionId,
        assessmentId
      );
      sendResponse({ res, ...response, statusCode: 200 });
    } catch (error) {
      sendResponse({
        res,
        status: "error",
        message: "Failed",
        statusCode: 500,
        error,
      });
    }
  }
}
