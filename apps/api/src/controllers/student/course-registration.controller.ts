import { CourseRegistration } from "@webcampus/api/src/services/student/course-registration.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { CreateCourseRegistrationType } from "@webcampus/schemas/student";
import { Request, Response } from "express";

export class CourseRegistrationController {
  static async createMyRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
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

      const request: CreateCourseRegistrationType = req.body;
      const response = await CourseRegistration.createForStudent(
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
      logger.error("Error creating course registration:", { error });
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

  static async getMyRegistrations(req: Request, res: Response): Promise<void> {
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

      const response = await CourseRegistration.getByStudentUserId(userId);
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
      logger.error("Error retrieving course registrations:", { error });
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

  static async getMyEligibleCourses(
    req: Request,
    res: Response
  ): Promise<void> {
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

      const response =
        await CourseRegistration.getEligibleCoursesForStudent(userId);
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
      logger.error("Error retrieving eligible courses:", { error });
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
