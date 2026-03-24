import { SectionService } from "@webcampus/api/src/services/department/section.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  CreateSectionType,
  GenerateSectionsDTO,
  SectionQueryType,
} from "@webcampus/schemas/department";
import { Request, Response } from "express";

export class SectionController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateSectionType = req.body;
      const response = await SectionService.create(request);
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
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query: SectionQueryType = req.query;
      const response = await SectionService.getAll(query);
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
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
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
      const response = await SectionService.delete(req.params.id);
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
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async generateSections(req: Request, res: Response): Promise<void> {
    try {
      const data: GenerateSectionsDTO = req.body;
      const response = await SectionService.generateSections(data);
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
        statusCode: error instanceof Error ? 400 : 500,
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
      const response = await SectionService.getUnassignedCount(
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
      logger.error("Error fetching unassigned count:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
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
        statusCode: error instanceof Error ? 400 : 500,
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
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }
}
