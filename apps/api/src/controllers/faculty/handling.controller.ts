import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { Request, Response } from "express";
import { FacultyHandlingService } from "../../services/faculty/handling.service";

type FacultyHandlingQueryType = {
  search?: string;
  academicTermId?: string;
  programType?: "UG" | "PG";
  semesterId?: string;
  sectionId?: string;
  batchId?: string;
  courseId?: string;
  academicYear?: string;
  page?: number;
  limit?: number;
};

type FacultyHandlingAssignmentParamsType = {
  assignmentId: string;
};

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

  if (message.toLowerCase().includes("forbidden")) {
    return 403;
  }

  if (message.toLowerCase().includes("not found")) {
    return 404;
  }

  return 400;
};

export class FacultyHandlingController {
  static async getCourseFilterOptions(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await FacultyHandlingService.getFilterOptions(
        user.id,
        "THEORY"
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        message: response.message,
        data: response.data,
        statusCode: 200,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching faculty course filter options", {
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

  static async getLabFilterOptions(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await FacultyHandlingService.getFilterOptions(
        user.id,
        "LAB"
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        message: response.message,
        data: response.data,
        statusCode: 200,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching faculty lab filter options", {
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

  static async getCourses(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as FacultyHandlingQueryType;
      const user = await resolveSessionUser(req);
      const response = await FacultyHandlingService.getHandlingAssignments(
        user.id,
        "THEORY",
        query
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        message: response.message,
        data: response.data,
        statusCode: 200,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching faculty course handling", {
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

  static async getLab(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as FacultyHandlingQueryType;
      const user = await resolveSessionUser(req);
      const response = await FacultyHandlingService.getHandlingAssignments(
        user.id,
        "LAB",
        query
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        message: response.message,
        data: response.data,
        statusCode: 200,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching faculty lab handling", {
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

  static async getCourseStudents(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as FacultyHandlingAssignmentParamsType;
      const query = req.query as FacultyHandlingQueryType;
      const user = await resolveSessionUser(req);
      const response = await FacultyHandlingService.getStudentsByAssignment(
        user.id,
        params.assignmentId,
        "THEORY",
        query
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        message: response.message,
        data: response.data,
        statusCode: 200,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching students for faculty course handling", {
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

  static async getLabStudents(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as FacultyHandlingAssignmentParamsType;
      const query = req.query as FacultyHandlingQueryType;
      const user = await resolveSessionUser(req);
      const response = await FacultyHandlingService.getStudentsByAssignment(
        user.id,
        params.assignmentId,
        "LAB",
        query
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        message: response.message,
        data: response.data,
        statusCode: 200,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error fetching students for faculty lab handling", {
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
