import { RegistrationTrackingService } from "@webcampus/api/src/services/admin/registration-tracking.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  GetRegistrationTrackingQueryType,
  GetStudentRegisteredCoursesParamsType,
  GetStudentRegisteredCoursesQueryType,
} from "@webcampus/schemas/admin";
import type { Request, Response } from "express";

export class RegistrationTrackingController {
  private static getStatusCode(error: unknown): number {
    if (!(error instanceof Error)) {
      return 500;
    }

    if (
      error.message === "Semester not found" ||
      error.message === "Student not found"
    ) {
      return 404;
    }

    return 500;
  }

  static async getStudentRegistrationStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const query = req.query as unknown as GetRegistrationTrackingQueryType;
      const response =
        await RegistrationTrackingService.getStudentRegistrationStatus(query);

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error fetching registration tracking data", error);
      sendResponse({
        res,
        status: "error",
        statusCode: RegistrationTrackingController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getStudentRegisteredCourses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const params =
        req.params as unknown as GetStudentRegisteredCoursesParamsType;
      const query =
        req.query as unknown as GetStudentRegisteredCoursesQueryType;

      const response =
        await RegistrationTrackingService.getStudentRegisteredCourses(
          params.studentId,
          query.semesterId,
          query.academicTermId
        );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error fetching student registered courses", error);
      sendResponse({
        res,
        status: "error",
        statusCode: RegistrationTrackingController.getStatusCode(error),
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
