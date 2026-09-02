import { CourseAssignmentService } from "@webcampus/api/src/services/department/course-assignment.service";
import { getDepartmentRequestContext } from "@webcampus/api/src/utils/request-context";
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
  /**
   * GET /status
   * Returns mapping status for all courses in a semester/department.
   */
  static async getMappingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId, academicYear, cycle } =
        req.query as CourseMappingStatusQueryType;
      const departmentContext = await getDepartmentRequestContext(req);

      const response = await CourseAssignmentService.getMappingStatus(
        semesterId,
        academicYear,
        departmentContext.userId,
        cycle,
        {
          requesterRole: "department",
          requestContext: departmentContext,
        }
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
  static async getMappingByCourse(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, semesterId, academicYear } =
        req.query as CourseMappingByCourseQueryType;
      const departmentContext = await getDepartmentRequestContext(req);

      const response = await CourseAssignmentService.getMappingByCourse(
        courseId,
        semesterId,
        academicYear,
        departmentContext.userId,
        {
          requesterRole: "department",
          requestContext: departmentContext,
        }
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
  static async upsertMapping(req: Request, res: Response): Promise<void> {
    try {
      const data: UpsertCourseMappingType = req.body;
      const departmentContext = await getDepartmentRequestContext(req);

      const response = await CourseAssignmentService.upsertMapping(
        data,
        departmentContext.userId,
        {
          requesterRole: "department",
          requestContext: departmentContext,
        }
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
      const departmentContext = await getDepartmentRequestContext(req);
      const { scope } = req.query as { scope?: string };

      const response = await CourseAssignmentService.getFacultyForMapping(
        departmentContext.userId,
        {
          requesterRole: "department",
          requestContext: departmentContext,
        },
        scope
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
      const departmentContext = await getDepartmentRequestContext(req);

      const response = await CourseAssignmentService.getSectionsForMapping(
        semesterId,
        departmentContext.userId,
        cycle,
        {
          requesterRole: "department",
          requestContext: departmentContext,
        }
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

  static async downloadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, semesterId, academicYear } = req.query as {
        courseId: string;
        semesterId: string;
        academicYear: string;
      };
      const departmentContext = await getDepartmentRequestContext(req);

      const buffer = await CourseAssignmentService.generateMappingTemplate(
        courseId,
        semesterId,
        academicYear,
        departmentContext.userId,
        {
          requesterRole: "department",
          requestContext: departmentContext,
        }
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Course_Mapping_Template.xlsx`
      );
      res.send(buffer);
    } catch (error) {
      logger.error("Error generating Excel template:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  /**
   * POST /excel/upload
   * Parses the uploaded mapping template
   */
  static async uploadTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) throw new Error("No file uploaded");

      const departmentContext = await getDepartmentRequestContext(req);

      const response = await CourseAssignmentService.parseMappingUpload(
        req.file.buffer,
        departmentContext.userId,
        {
          requesterRole: "department",
          requestContext: departmentContext,
        }
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
      logger.error("Error parsing Excel template:", { error });
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
