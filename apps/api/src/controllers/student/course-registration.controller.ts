import { CourseRegistration } from "@webcampus/api/src/services/student/course-registration.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { SubmitCourseRegistrationType } from "@webcampus/schemas/student";
import { Request, Response } from "express";

export class CourseRegistrationController {
  static async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;
      if (!userId) {
        sendResponse({
          res,
          status: "error",
          message: ERRORS.UNAUTHORIZED,
          statusCode: 401,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const response =
        await CourseRegistration.getRegistrationDashboard(userId);
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
      logger.error("Error retrieving registration dashboard:", { error });
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

  static async getCurriculum(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;
      if (!userId) {
        sendResponse({
          res,
          status: "error",
          message: ERRORS.UNAUTHORIZED,
          statusCode: 401,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const response = await CourseRegistration.getAvailableCurriculum(userId);
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
      logger.error("Error retrieving available curriculum:", { error });
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

  static async submitRegistration(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;
      if (!userId) {
        sendResponse({
          res,
          status: "error",
          message: ERRORS.UNAUTHORIZED,
          error: ERRORS.UNAUTHORIZED,
          statusCode: 401,
        });
        return;
      }

      const request: SubmitCourseRegistrationType = req.body;
      const response = await CourseRegistration.submitRegistration(
        userId,
        request
      );
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
      logger.error("Error submitting registration:", { error });
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

  static async getEnrolledCourses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.requestContext?.userId;
      if (!userId) {
        sendResponse({
          res,
          status: "error",
          message: ERRORS.UNAUTHORIZED,
          statusCode: 401,
          error: ERRORS.UNAUTHORIZED,
        });
        return;
      }

      const semesterId =
        typeof req.query.semesterId === "string"
          ? req.query.semesterId
          : undefined;

      const response = await CourseRegistration.getEnrolledCourses(
        userId,
        semesterId
      );
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
      logger.error("Error retrieving enrolled courses:", { error });
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
