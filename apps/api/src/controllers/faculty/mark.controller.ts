import { Mark } from "@webcampus/api/src/services/faculty/mark.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { UpdateMarkType } from "@webcampus/schemas/faculty";
import { Request, Response } from "express";

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

export class MarkController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const response = await Mark.create(req.body);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 201,
        });
      }
    } catch (error) {
      logger.error("Error creating mark:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const response = await Mark.getAll();
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      }
    } catch (error) {
      logger.error("Error retrieving marks:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getById(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const response = await Mark.getById(req.params.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: response.data ? 200 : 404,
        });
      }
    } catch (error) {
      logger.error("Error retrieving mark:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getByStudentAndCourse(
    req: Request<{ studentId: string; courseId: string }>,
    res: Response
  ): Promise<void> {
    try {
      const response = await Mark.getByStudentAndCourse(
        req.params.studentId,
        req.params.courseId
      );
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: response.data ? 200 : 404,
        });
      }
    } catch (error) {
      logger.error("Error retrieving mark:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async update(
    req: Request<{ id: string }, UpdateMarkType>,
    res: Response
  ): Promise<void> {
    try {
      const response = await Mark.update(req.params.id, req.body);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: response.data ? 200 : 404,
        });
      }
    } catch (error) {
      logger.error("Error updating mark:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async delete(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const response = await Mark.delete(req.params.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      }
    } catch (error) {
      logger.error("Error deleting mark:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getMarksDashboard(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const response = await Mark.getMarksDashboard(user.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error retrieving marks dashboard:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async getAssessmentWithMarks(
    req: Request<{ assessmentId: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const sectionId = req.query.sectionId as string | undefined;
      const response = await Mark.getAssessmentTemplateWithMarks(
        user.id,
        req.params.assessmentId,
        sectionId
      );
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error retrieving assessment with marks:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async saveAssessmentMarks(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const response = await Mark.saveAssessmentMarks(user.id, req.body);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error saving assessment marks:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async getMarksReport(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const courseId = req.query.courseId as string;
      const sectionId = req.query.sectionId as string | undefined;

      if (!courseId) {
        sendResponse({
          res,
          status: "error",
          message: "courseId is required",
          statusCode: 400,
          error: "Missing courseId",
        });
        return;
      }

      const response = await Mark.getMarksReport(user.id, courseId, sectionId);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error fetching marks report:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async getMarksReportFilterOptions(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const response = await Mark.getMarksReportFilterOptions(user.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error fetching marks report filter options:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }
}
