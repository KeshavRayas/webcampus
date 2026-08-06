import { StudentProfileService } from "@webcampus/api/src/services/student/profile.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { UpdateStudentProfileType } from "@webcampus/schemas/student";
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

export class StudentProfileController {
  static async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await StudentProfileService.getProfileByUserId(user.id);
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
      const isMissingProfile =
        errorMessage === "Student profile not found" ||
        errorMessage === "Admission record not linked for this student";

      logger.error("Error retrieving student profile", { error });
      sendResponse({
        res,
        status: "error",
        message: errorMessage,
        statusCode: isMissingProfile ? 404 : 500,
        error,
      });
    }
  }

  static async updateMyProfile(
    req: Request<Record<string, string>, unknown, UpdateStudentProfileType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await StudentProfileService.updateOwnProfile(
        user.id,
        req.body
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
      logger.error("Error updating student profile", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async requestProfileApproval(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await StudentProfileService.requestApprovalByUserId(
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
      logger.error("Error requesting student profile approval", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }
}
