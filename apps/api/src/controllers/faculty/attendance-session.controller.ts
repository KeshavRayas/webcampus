import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  CreateOrOpenFacultyAttendanceSessionType,
  FacultyAttendanceSessionDetailQueryType,
  FacultyAttendanceSessionStudentsQueryType,
  ListFacultyAttendanceSessionsQueryType,
} from "@webcampus/schemas/faculty";
import type { Request, Response } from "express";
import { FacultyAttendanceSessionService } from "../../services/faculty/attendance-session.service";

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
  if (message === ERRORS.UNAUTHENTICATED) {
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

export class FacultyAttendanceSessionController {
  static async getSessionDetail(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const query = req.query as FacultyAttendanceSessionDetailQueryType;
      const response = await FacultyAttendanceSessionService.getSessionDetail(
        user.id,
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

      logger.error("Error fetching faculty attendance session detail", {
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

  static async getSessionStudents(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const query = req.query as FacultyAttendanceSessionStudentsQueryType;
      const response = await FacultyAttendanceSessionService.getSessionStudents(
        user.id,
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

      logger.error("Error fetching faculty attendance session students", {
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

  static async getFilterOptions(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await FacultyAttendanceSessionService.getFilterOptions(user.id);

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

      logger.error("Error fetching faculty attendance filter options", {
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

  static async createOrOpenSession(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const payload = req.body as CreateOrOpenFacultyAttendanceSessionType;
      const response = await FacultyAttendanceSessionService.createOrOpenSession(
        user.id,
        payload
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        message: response.message,
        data: response.data,
        statusCode: response.data?.created ? 201 : 200,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error creating/opening faculty attendance session", {
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

  static async listSessions(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const query = req.query as ListFacultyAttendanceSessionsQueryType;
      const response = await FacultyAttendanceSessionService.listSessions(
        user.id,
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

      logger.error("Error listing faculty attendance sessions", {
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
