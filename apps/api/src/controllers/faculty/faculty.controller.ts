import { Faculty } from "@webcampus/api/src/services/faculty/faculty.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type {
  CreateFacultyExperienceType,
  CreateFacultyPublicationType,
  CreateFacultyQualificationType,
  UpdateFacultyExperienceType,
  UpdateFacultyProfileType,
  UpdateFacultyPublicationType,
  UpdateFacultyQualificationType,
} from "@webcampus/schemas/faculty";
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

export class FacultyController {
  static async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.getProfileByUserId(user.id);

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
      const isMissingProfile = errorMessage === "Faculty profile not found";

      logger.error("Error retrieving faculty profile", { error });
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
    req: Request<Record<string, string>, unknown, UpdateFacultyProfileType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const isAdmin = user.role === "admin";
      const response = await Faculty.updateProfileByUserId(
        user.id,
        req.body,
        isAdmin
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
      logger.error("Error updating faculty profile", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async createQualification(
    req: Request<Record<string, string>, unknown, CreateFacultyQualificationType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.createQualificationByUserId(user.id, req.body);
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
      logger.error("Error creating qualification", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async updateQualification(
    req: Request<{ id: string }, unknown, UpdateFacultyQualificationType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.updateQualificationByUserId(
        user.id,
        req.params.id,
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
      logger.error("Error updating qualification", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async deleteQualification(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.deleteQualificationByUserId(
        user.id,
        req.params.id
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
      logger.error("Error deleting qualification", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async createPublication(
    req: Request<Record<string, string>, unknown, CreateFacultyPublicationType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.createPublicationByUserId(user.id, req.body);
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
      logger.error("Error creating publication", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async updatePublication(
    req: Request<{ id: string }, unknown, UpdateFacultyPublicationType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.updatePublicationByUserId(
        user.id,
        req.params.id,
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
      logger.error("Error updating publication", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async deletePublication(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.deletePublicationByUserId(
        user.id,
        req.params.id
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
      logger.error("Error deleting publication", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async createExperience(
    req: Request<Record<string, string>, unknown, CreateFacultyExperienceType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.createExperienceByUserId(user.id, req.body);
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
      logger.error("Error creating experience", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async updateExperience(
    req: Request<{ id: string }, unknown, UpdateFacultyExperienceType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.updateExperienceByUserId(
        user.id,
        req.params.id,
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
      logger.error("Error updating experience", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async deleteExperience(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Faculty.deleteExperienceByUserId(
        user.id,
        req.params.id
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
      logger.error("Error deleting experience", { error });
      sendResponse({
        res,
        status: "error",
        message: error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }
}
