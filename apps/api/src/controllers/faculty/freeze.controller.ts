import { FreezeService } from "@webcampus/api/src/services/faculty/freeze.service";
import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import type {
  GetFreezeParamsType,
  GetFreezeStateQueryType,
  ToggleFreezeParamsType,
} from "@webcampus/schemas/faculty";
import type { RequestContext } from "@webcampus/types/request-context";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";

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
  return 500;
};

export class FreezeController {
  static async getFreezeState(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as unknown as GetFreezeStateQueryType;
      const requestContext = (req as { requestContext?: RequestContext })
        .requestContext;

      if (!requestContext?.userId) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      if (query.courseAssignmentId) {
        const freezeState = await FreezeService.getFreezeState(
          query.courseAssignmentId
        );
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: "Freeze state fetched",
          data: freezeState,
        });
        return;
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Freeze state fetched",
        data: [],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to get freeze state";
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCodeForError(message),
        message,
        error,
      });
    }
  }

  static async toggleFreeze(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as unknown as ToggleFreezeParamsType;
      const requestContext = (req as { requestContext?: RequestContext })
        .requestContext;

      if (!requestContext?.userId || !requestContext.role) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const freezeState = await FreezeService.freeze(
        {
          courseAssignmentId: params.courseAssignmentId,
        },
        requestContext.role,
        session?.user?.username,
        session?.user?.displayUsername
      );

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Attendance frozen",
        data: freezeState,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to freeze attendance";
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCodeForError(message),
        message,
        error,
      });
    }
  }

  static async getFreezeForCourseAssignment(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const params = req.params as unknown as GetFreezeParamsType;

      const freezeState = await FreezeService.getFreezeState(
        params.courseAssignmentId
      );

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Freeze state fetched",
        data: freezeState,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to get freeze";
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCodeForError(message),
        message,
        error,
      });
    }
  }
}
