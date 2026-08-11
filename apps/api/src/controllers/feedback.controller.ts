import { resolveFeedbackScope } from "@webcampus/api/src/services/shared/feedback-scope.service";
import { FeedbackService } from "@webcampus/api/src/services/shared/feedback.service";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import type {
  CourseDistributionQuery,
  FeedbackReportQuery,
} from "@webcampus/schemas/feedback";
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
          req.params.academicTermId as string,
          req.params.semesterId as string
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
      const academicTermId =
        typeof req.query.academicTermId === "string"
          ? req.query.academicTermId
          : undefined;
      const semesterId =
        typeof req.query.semesterId === "string"
          ? req.query.semesterId
          : undefined;
      reply(
        res,
        await FeedbackService.getFilterOptions(
          await resolveFeedbackScope(userId(req), role as never),
          { academicTermId, semesterId }
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

  static async deleteRound(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.deleteRound(req.params.id as string),
        "Feedback round deleted successfully"
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

  static async dashboard(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getDashboard(),
        "Feedback dashboard fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async roundFaculties(req: Request, res: Response) {
    try {
      const departmentId = (req.query.departmentId ?? undefined) as
        | string
        | undefined;
      reply(
        res,
        await FeedbackService.getRoundFaculties(
          req.params.roundId as string,
          departmentId
        ),
        "Feedback faculties fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async courseDistribution(req: Request, res: Response) {
    try {
      const query: CourseDistributionQuery = {
        facultyId: req.query.facultyId as string,
        courseId: req.query.courseId as string,
        ...(req.query.sectionId
          ? { sectionId: req.query.sectionId as string }
          : {}),
      };
      reply(
        res,
        await FeedbackService.getCourseDistribution(
          req.params.roundId as string,
          query
        ),
        "Feedback course distribution fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async facultyCourses(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getRoundFacultyCourses(
          req.params.roundId as string,
          req.params.facultyId as string
        ),
        "Feedback courses fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async courseSections(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getRoundCourseSections(
          req.params.roundId as string,
          req.params.facultyId as string,
          req.params.courseId as string
        ),
        "Feedback sections fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }

  static async sectionStudents(req: Request, res: Response) {
    try {
      reply(
        res,
        await FeedbackService.getRoundSectionStudents(
          req.params.roundId as string,
          req.params.facultyId as string,
          req.params.courseId as string,
          req.params.sectionId as string
        ),
        "Feedback students fetched successfully"
      );
    } catch (error) {
      fail(res, error);
    }
  }
}
