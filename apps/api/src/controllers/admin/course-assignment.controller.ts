import { AdminCourseAssignmentService } from "@webcampus/api/src/services/admin/course-assignment.service";
import { AdminCourseMappingExcelService } from "@webcampus/api/src/services/admin/course-mapping-excel.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type {
  AdminCourseMappingByCourseQueryType,
  AdminCourseMappingStatusQueryType,
  AdminUpsertCourseMappingType,
} from "@webcampus/schemas/admin";
import type { Request, Response } from "express";

export class AdminCourseAssignmentController {
  private static async getRequestingUserId(req: Request): Promise<string> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    return session.user.id;
  }

  static async getMappingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId, departmentId, departmentName, academicYear, cycle } =
        req.query as AdminCourseMappingStatusQueryType;
      const requestingUserId =
        await AdminCourseAssignmentController.getRequestingUserId(req);

      const response = await AdminCourseAssignmentService.getMappingStatus(
        semesterId,
        academicYear,
        requestingUserId,
        {
          departmentId,
          departmentName: departmentId ? undefined : departmentName,
        },
        cycle
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error retrieving admin mapping status", { error });
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

  static async getMappingByCourse(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, semesterId, academicYear } =
        req.query as AdminCourseMappingByCourseQueryType;
      const requestingUserId =
        await AdminCourseAssignmentController.getRequestingUserId(req);

      const response = await AdminCourseAssignmentService.getMappingByCourse(
        courseId,
        semesterId,
        academicYear,
        requestingUserId,
        {
          departmentId: (req.query as AdminCourseMappingByCourseQueryType)
            .departmentId,
          departmentName: (req.query as AdminCourseMappingByCourseQueryType)
            .departmentId
            ? undefined
            : (req.query as AdminCourseMappingByCourseQueryType).departmentName,
        }
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error fetching admin mapping by course", { error });
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

  static async upsertMapping(req: Request, res: Response): Promise<void> {
    try {
      const data: AdminUpsertCourseMappingType = req.body;
      const requestingUserId =
        await AdminCourseAssignmentController.getRequestingUserId(req);

      const response = await AdminCourseAssignmentService.upsertMapping(
        data,
        requestingUserId,
        {
          departmentId: data.departmentId,
          departmentName: data.departmentId ? undefined : data.departmentName,
        }
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error upserting admin course mappings", { error });
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

  static async getFacultyForMapping(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const requestingUserId =
        await AdminCourseAssignmentController.getRequestingUserId(req);
      const { departmentId, departmentName } = req.query as {
        departmentId?: string;
        departmentName?: string;
      };

      const response = await AdminCourseAssignmentService.getFacultyForMapping(
        requestingUserId,
        {
          departmentId,
          departmentName: departmentId ? undefined : departmentName,
        }
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error fetching admin faculty for mapping", { error });
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

  static async getSectionsForMapping(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const requestingUserId =
        await AdminCourseAssignmentController.getRequestingUserId(req);
      const { semesterId, cycle, departmentId, departmentName } = req.query as {
        semesterId: string;
        cycle?: string;
        departmentId?: string;
        departmentName?: string;
      };

      const response = await AdminCourseAssignmentService.getSectionsForMapping(
        semesterId,
        requestingUserId,
        {
          departmentId,
          departmentName: departmentId ? undefined : departmentName,
        },
        cycle
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      logger.error("Error fetching admin sections for mapping", { error });
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
      const { courseId, semesterId, departmentId } = req.query as {
        courseId: string;
        semesterId: string;
        departmentId: string;
      };
      const buffer = await AdminCourseMappingExcelService.generateTemplate(
        courseId,
        semesterId,
        departmentId
      );

      // not using sendResponse here because we are sending a raw binary file stream
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=course-mapping-template.xlsx"
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.send(buffer);
    } catch (error) {
      logger.error("Error generating Excel template", { error });
      res.status(500).send("Failed to generate Excel template");
    }
  }

  static async uploadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, semesterId, departmentId, academicYear } = req.body;
      const file = req.file; // provided by multer middleware
      const requestingUserId =
        await AdminCourseAssignmentController.getRequestingUserId(req);

      if (!file) throw new Error("No file uploaded");

      const response =
        await AdminCourseMappingExcelService.parseAndUpsertUpload(
          file.buffer, // passing the raw memory buffer to our service
          courseId,
          semesterId,
          departmentId,
          academicYear,
          requestingUserId
        );

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Excel mappings uploaded successfully",
        data: response,
      });
    } catch (error: unknown) {
      console.error(error);
      logger.error("Error uploading excel mapping", { error });
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

  static async deleteMappings(req: Request, res: Response): Promise<void> {
    try {
      const { courseId, semesterId, academicYear } = req.body as {
        courseId: string;
        semesterId: string;
        academicYear: string;
        departmentId?: string;
        departmentName?: string;
      };
      const requestingUserId =
        await AdminCourseAssignmentController.getRequestingUserId(req);

      const response = await AdminCourseAssignmentService.deleteMappings(
        courseId,
        semesterId,
        academicYear,
        requestingUserId,
        {
          departmentId: (req.body as { departmentId?: string }).departmentId,
          departmentName: (req.body as { departmentId?: string }).departmentId
            ? undefined
            : (req.body as { departmentName?: string }).departmentName,
        }
      );

      if (response.status !== "success") {
        throw new Error(response.message);
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error: unknown) {
      console.error(error);
      logger.error("Error deleting admin mappings", { error });
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
