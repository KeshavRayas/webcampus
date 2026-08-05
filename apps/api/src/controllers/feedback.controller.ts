import { resolveHODDepartment } from "@webcampus/api/src/services/hod/resolve-hod-department";
import { FeedbackService } from "@webcampus/api/src/services/shared/feedback.service";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import type { FeedbackReportQuery } from "@webcampus/schemas/feedback";
import type { Request, Response } from "express";

const userId = (req: Request) => {
  if (!req.requestContext?.userId) throw new Error("Unauthorized");
  return req.requestContext.userId;
};

const reply = (
  res: Response,
  data: unknown,
  message: string,
  statusCode = 200
) => sendResponse({ res, status: "success", message, data, statusCode });

const fail = (res: Response, error: unknown) =>
  sendResponse({
    res,
    status: "error",
    message: error instanceof Error ? error.message : "Request failed",
    error,
    statusCode:
      error instanceof Error && error.message === "Unauthorized" ? 401 : 400,
  });

export class FeedbackController {
  static async studentEligible(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getStudentFeedback(userId(req)),
        "Feedback options fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async studentSubmit(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.submitStudentFeedback(userId(req), req.body),
        "Feedback submitted successfully",
        201
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async configuration(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getConfiguration(req.params.semesterId as string),
        "Feedback configuration fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async filterOptions(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getFilterOptions(),
        "Feedback filters fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async saveQuestions(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.saveQuestionSet(userId(req), req.body),
        "Feedback questions saved successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async createRound(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.createRound(userId(req), req.body),
        "Feedback round created successfully",
        201
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async updateRound(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.updateRound(req.params.id as string, req.body),
        "Feedback round updated successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async enableRound(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.setRoundEnabled(req.params.id as string, true),
        "Feedback round enabled successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async disableRound(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.setRoundEnabled(req.params.id as string, false),
        "Feedback round disabled successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async report(req: Request, res: Response) {
    try {
      const query = req.query as FeedbackReportQuery;
      const role = req.requestContext?.role;
      let scope: { facultyId?: string; departmentId?: string } | undefined;
      if (role === "faculty") {
        const faculty = await (
          await import("@webcampus/db")
        ).db.faculty.findUnique({
          where: { userId: userId(req) },
          select: { id: true },
        });
        if (!faculty) throw new Error("Faculty profile not found");
        scope = { facultyId: faculty.id };
      }
      if (role === "hod") {
        const department = await resolveHODDepartment(userId(req));
        if (!department) throw new Error("HOD department not found");
        scope = { departmentId: department.departmentId };
      }
      if (role === "department") {
        const membership = await (
          await import("@webcampus/db")
        ).db.departmentUser.findFirst({
          where: { userId: userId(req), role: { in: ["ADMIN", "VIEWER"] } },
          select: { departmentId: true },
        });
        if (!membership) throw new Error("Department membership not found");
        scope = { departmentId: membership.departmentId };
      }
      reply(
        res,
        await FeedbackService.getReport(query, scope),
        "Feedback report fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }
}
