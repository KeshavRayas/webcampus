import { SectionService } from "@webcampus/api/src/services/department/section.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  CreateSectionType,
  DetailedGenerationPreviewRequestDTO,
  GenerateCycleSectionsDTO,
  GenerateSectionsDTO,
  SectionQueryType,
} from "@webcampus/schemas/department";
import { Request, Response } from "express";

export class SectionController {
  private static getErrorStatusCode(error: unknown): number {
    if (!(error instanceof Error)) {
      return 500;
    }

    if (error.message === "Unauthorized") {
      return 401;
    }

    if (error.message.includes("managed by the Basic Sciences")) {
      return 403;
    }

    return 400;
  }

  private static async getRequestingUserId(req: Request): Promise<string> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    return session.user.id;
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateSectionType = req.body;
      const requestingUserId = await SectionController.getRequestingUserId(req);
      const response = await SectionService.create(request, requestingUserId);
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
      logger.error({ error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query: SectionQueryType = req.query;
      const requestingUserId = await SectionController.getRequestingUserId(req);
      const response = await SectionService.getAll(query, requestingUserId);
      if (response.status === "success") {
        sendResponse({
          res,
          statusCode: 200,
          status: "success",
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error({ error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async getById(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const response = await SectionService.getById(req.params.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: response.data ? 200 : 404,
        });
      }
    } catch (error) {
      logger.error("Error retrieving section:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async delete(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const requestingUserId = await SectionController.getRequestingUserId(req);
      await SectionService.assertSectionWriteAccess(
        req.params.id,
        requestingUserId
      );

      const response = await SectionService.deleteSection(req.params.id);
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
      logger.error("Error deleting section:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async generateSections(req: Request, res: Response): Promise<void> {
    try {
      const data: GenerateSectionsDTO = req.body;
      const requestingUserId = await SectionController.getRequestingUserId(req);
      const response = await SectionService.generateSections(
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
      logger.error("Error generating sections:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async getUnassignedCount(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId, departmentName } = req.query as {
        semesterId: string;
        departmentName: string;
      };
      const requestingUserId = await SectionController.getRequestingUserId(req);
      const response = await SectionService.getUnassignedCount(
        semesterId,
        departmentName,
        requestingUserId
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
      logger.error("Error fetching unassigned count:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async getUnassignedStudentCounts(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { termId, semesterNumber } = req.query as {
        termId: string;
        semesterNumber: string;
      };

      const parsedSemesterNumber = Number(semesterNumber);
      if (!termId || Number.isNaN(parsedSemesterNumber)) {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: "termId and valid semesterNumber are required",
          error: "Invalid query params",
        });
        return;
      }

      const response = await SectionService.getUnassignedStudentCounts(
        termId,
        parsedSemesterNumber
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
      logger.error("Error fetching unassigned student counts:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async getSectionsWithStudents(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { semesterId, departmentName } = req.query as {
        semesterId: string;
        departmentName: string;
      };
      const response = await SectionService.getSectionsWithStudents(
        semesterId,
        departmentName
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
      logger.error("Error fetching sections with students:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getUnassignedStudents(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { semesterId, departmentName } = req.query as {
        semesterId: string;
        departmentName: string;
      };
      const response = await SectionService.getUnassignedStudents(
        semesterId,
        departmentName
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
      logger.error("Error fetching unassigned students:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async assignStudentsToSection(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { sectionId, studentIds, academicYear } = req.body as {
        sectionId: string;
        studentIds: string[];
        academicYear: string;
      };
      const requestingUserId = await SectionController.getRequestingUserId(req);
      await SectionService.assertSectionWriteAccess(
        sectionId,
        requestingUserId
      );

      const response = await SectionService.assignStudentsToSection(
        sectionId,
        studentIds,
        academicYear
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
      logger.error("Error assigning students to section:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async generateCycleSections(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const data: GenerateCycleSectionsDTO = req.body;

      // Resolve the requesting department name from the session
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user?.id) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: "Unauthorized",
          error: "Unauthorized",
        });
        return;
      }

      const departmentName = session.user.name ?? "";
      const response = await SectionService.generateCycleSections(
        data,
        departmentName,
        session.user.id
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
      logger.error("Error generating cycle sections:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: SectionController.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async getDetailedGenerationPreview(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        semesterId,
        allocations,
        cycle,
        studentsPerSection,
      }: DetailedGenerationPreviewRequestDTO = req.body;

      const requestingUserId = await SectionController.getRequestingUserId(req);

      const response = await SectionService.getDetailedGenerationPreview(
        semesterId,
        allocations,
        cycle,
        studentsPerSection ?? 60,
        requestingUserId
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
      logger.error("Error fetching detailed generation preview:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: this.getErrorStatusCode(error),
        error,
      });
    }
  }

  static async getDepartmentInfo(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user?.id) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: "Unauthorized",
          error: "Unauthorized",
        });
        return;
      }

      const { db } = await import("@webcampus/db");
      const department = await db.department.findFirst({
        where: { userId: session.user.id },
        select: { type: true, name: true, id: true },
      });

      if (!department) {
        sendResponse({
          res,
          status: "error",
          statusCode: 404,
          message: "Department not found",
          error: "Department not found",
        });
        return;
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Department info fetched",
        data: department,
      });
    } catch (error) {
      logger.error("Error fetching department info:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }
}
