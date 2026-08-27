import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  CreateOrOpenFacultyAttendanceSessionType,
  DeleteFacultyAttendanceSessionParamsType,
  FacultyAttendanceSessionDetailQueryType,
  FacultyAttendanceSessionStudentsQueryType,
  ListFacultyAttendanceSessionsQueryType,
  UpdateFacultyAttendanceSessionType,
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

  if (message.toLowerCase().includes("already taken")) {
    return 409;
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
      const response = await FacultyAttendanceSessionService.getFilterOptions(
        user.id
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

  static async createSession(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const payload = req.body as CreateOrOpenFacultyAttendanceSessionType;
      const response = await FacultyAttendanceSessionService.createSession(
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
        statusCode: 201,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      logger.error("Error creating faculty attendance session", {
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

  static async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const sessionId = req.params.sessionId as string;
      const payload = req.body as UpdateFacultyAttendanceSessionType;
      const response = await FacultyAttendanceSessionService.updateSession(
        user.id,
        sessionId,
        payload.studentStatuses ?? []
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

      logger.error("Error updating faculty attendance session", {
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
      logger.info("listSessions: user resolved", {
        userId: user.id,
        email: user.email,
      });
      const query = req.query as ListFacultyAttendanceSessionsQueryType;
      logger.info("listSessions: query params", { query });
      const response = await FacultyAttendanceSessionService.listSessions(
        user.id,
        query
      );

      logger.info("listSessions: response status", {
        status: response.status,
        message: response.message,
      });

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

  static async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const params = req.params as DeleteFacultyAttendanceSessionParamsType;
      const response = await FacultyAttendanceSessionService.deleteSession(
        user.id,
        params
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

      logger.error("Error deleting faculty attendance session", {
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
