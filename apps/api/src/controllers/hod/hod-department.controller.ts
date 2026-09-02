import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import { HODDepartmentService } from "../../services/hod/hod-department.service";

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (
    error.message.includes("not found") ||
    error.message === "HOD profile not found or department not assigned"
  ) {
    return 404;
  }
  return 500;
};

const requireSession = async (req: Request, res: Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session?.user?.id) {
    sendResponse({
      res,
      status: "error",
      statusCode: 401,
      message: ERRORS.UNAUTHORIZED,
      error: ERRORS.UNAUTHORIZED,
    });
    return null;
  }
  return session;
};

export class HODDepartmentController {
  static async getDepartment(req: Request, res: Response): Promise<void> {
    try {
      const session = await requireSession(req, res);
      if (!session) return;

      const result = await HODDepartmentService.getDepartmentInfo(
        session.user.id
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Department fetched successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error fetching HOD department", error);
      sendResponse({
        res,
        status: "error",
        statusCode: getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
