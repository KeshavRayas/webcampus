import { CourseAssignmentService } from "@webcampus/api/src/services/department/course-assignment.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type {
  CourseMappingByCourseQueryType,
  CourseMappingStatusQueryType,
  UpsertCourseMappingType,
} from "@webcampus/schemas/department";
import type { Request, Response } from "express";

export class CourseAssignmentController {
  private static async getRequestingUserId(req: Request): Promise<string> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    return session.user.id;
  }

  /**
   * GET /status
   * Returns mapping status for all courses in a semester/department.
   */
  static async getMappingStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { semesterId, departmentName, academicYear, cycle } =
        req.query as CourseMappingStatusQueryType;

      const response = await CourseAssignmentService.getMappingStatus(
        semesterId,
        departmentName,
        academicYear,
        cycle
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
      logger.error("Error fetching mapping status:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  /**
   * GET /by-course
   * Returns existing mappings for a specific course.
   */
  static async getMappingByCourse(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { courseId, semesterId, academicYear } = req.query as {
        courseId: string;
      } & CourseMappingByCourseQueryType;

      const response = await CourseAssignmentService.getMappingByCourse(
        courseId,
        semesterId,
        academicYear
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
      logger.error("Error fetching course mappings:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  /**
   * POST /upsert
   * Saves (upserts) course mappings.
   */
  static async upsertMapping(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const data: UpsertCourseMappingType = req.body;
      const requestingUserId =
        await CourseAssignmentController.getRequestingUserId(req);

      const response = await CourseAssignmentService.upsertMapping(
        data,
        requestingUserId
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 201,
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error("Error saving course mapping:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  /**
   * GET /faculty
   * Returns faculty available for mapping comboboxes.
   */
  static async getFacultyForMapping(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const requestingUserId =
        await CourseAssignmentController.getRequestingUserId(req);

      const response =
        await CourseAssignmentService.getFacultyForMapping(requestingUserId);

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
      logger.error("Error fetching faculty for mapping:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  /**
   * GET /sections
   * Returns sections with batches for the mapping grid.
   */
  static async getSectionsForMapping(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { semesterId, cycle } = req.query as {
        semesterId: string;
        cycle?: string;
      };

      const requestingUserId =
        await CourseAssignmentController.getRequestingUserId(req);

      const response = await CourseAssignmentService.getSectionsForMapping(
        semesterId,
        requestingUserId,
        cycle
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
      logger.error("Error fetching sections for mapping:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }
}
