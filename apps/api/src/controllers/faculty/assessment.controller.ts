import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { AcademicTermQueryType } from "@webcampus/schemas/admin";
import { CreateAssessmentSchema } from "@webcampus/schemas/faculty";
import type { Request, Response } from "express";
import { SemesterService } from "../../services/admin/semester.service";
import { AssessmentService } from "../../services/faculty/assessment.service";

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

export class AssessmentController {
  /**
   * GET /terms
   * Returns academic terms with semesters, reusing the admin service safely.
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

      logger.error("Error fetching academic terms for faculty", {
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

  /**
   * GET /coordinated-courses
   * Returns courses where the session user is a designated coordinator.
   */
  static async getCoordinatedCourses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { semesterId, cycle } = req.query as {
        semesterId?: string;
        cycle?: string;
      };

      const response = await AssessmentService.getCoordinatedCourses(
        user.id,
        semesterId,
        cycle
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
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching coordinated courses", {
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

  /**
   * POST /
   * Creates a new assessment template directly
   */
  static async createAssessment(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const body = CreateAssessmentSchema.parse(req.body);

      const response = await AssessmentService.createAssessment(user.id, body);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 201,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error creating assessment", {
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

  /**
   * DELETE /:id
   * Deletes an assessment template
   */
  static async deleteAssessment(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new Error("Assessment ID is required");
      }

      const response = await AssessmentService.deleteAssessment(user.id, id);

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

      logger.error("Error deleting assessment", {
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

  /**
   * GET /:id
   * Fetches an assessment template with questions
   */
  static async getAssessmentById(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new Error("Assessment ID is required");
      }

      const response = await AssessmentService.getAssessmentById(user.id, id);

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

      logger.error("Error fetching assessment by ID", {
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
}
