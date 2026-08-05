import { resolveFeedbackScope } from "@webcampus/api/src/services/shared/feedback-scope.service";
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

  static async getTermConfiguration(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getTermConfiguration(
          req.params.academicTermId as string
        ),
        "Term feedback configuration fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async configureTerm(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.configureTerm(userId(req), req.body),
        "Term feedback configuration saved successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async presets(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.listPresets(
          typeof req.query.academicTermId === "string"
            ? req.query.academicTermId
            : undefined
        ),
        "Feedback presets fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async createPreset(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.createPreset(userId(req), req.body),
        "Feedback preset created successfully",
        201
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async filterOptions(req: Request, res: Response) {
    try {
      const role = req.requestContext?.role;
      if (
        !role ||
        !["faculty", "hod", "department", "coe", "admin"].includes(role)
      ) {
        throw new Error("Feedback reports are unavailable for this role");
      }
      reply(
        res,
        await FeedbackService.getFilterOptions(
          await resolveFeedbackScope(userId(req), role as never)
        ),
        "Feedback filters fetched successfully"
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
      if (
        !role ||
        !["faculty", "hod", "department", "coe", "admin"].includes(role)
      ) {
        throw new Error("Feedback reports are unavailable for this role");
      }
      const scope = await resolveFeedbackScope(userId(req), role as never);
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
