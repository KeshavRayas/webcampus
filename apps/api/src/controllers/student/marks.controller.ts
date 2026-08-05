import { StudentMarksService } from "@webcampus/api/src/services/student/marks.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { Request, Response } from "express";

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

export class StudentMarksController {
  static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const { semesterId } = req.query;

      const response = await StudentMarksService.getMarksSummary(
        user.id,
        semesterId as string
      );

      if (response.status === "success" && "data" in response) {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
        return;
      }

      const errorMessage = response.message || "Failed to fetch marks summary";
      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message: errorMessage,
        error: new Error(errorMessage),
      });
    } catch (error) {
      logger.error("Error in student marks summary controller", error);
      const errorMessage =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;

      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCodeForError(errorMessage),
        message: errorMessage,
        error,
      });
    }
  }
}
