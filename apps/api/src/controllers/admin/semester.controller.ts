import { SemesterService } from "@webcampus/api/src/services/admin/semester.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  AcademicTermQueryType,
  CreateAcademicTermType,
  CreateSemesterConfigType,
} from "@webcampus/schemas/admin";
import { Request, Response } from "express";

export class SemesterController {
  static async createAcademicTerm(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateAcademicTermType = req.body;
      const response = await SemesterService.createAcademicTerm(request);
      if (response.status === "success") {
        sendResponse({
          res,
          statusCode: 201,
          status: "success",
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error({ error });
      return sendResponse({
        res,
        statusCode: 500,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async updateAcademicTerm(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const request: CreateAcademicTermType = req.body;
      const response = await SemesterService.updateAcademicTerm(id, request);
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
      return sendResponse({
        res,
        statusCode: 400,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getAllAcademicTerms(req: Request, res: Response): Promise<void> {
    try {
      const request: AcademicTermQueryType = req.query;
      const response = await SemesterService.getAllAcademicTerms(request);
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
      return sendResponse({
        res,
        statusCode: 500,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async deleteAcademicTerm(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const response = await SemesterService.deleteAcademicTerm({ id });
      if (response.status === "success") {
        return sendResponse({
          res,
          statusCode: 200,
          status: "success",
          message: response.message,
          data: response.data,
        });
      }
    } catch (error) {
      logger.error({ error });
      return sendResponse({
        res,
        statusCode: 500,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async bulkUpsertSemesters(req: Request, res: Response): Promise<void> {
    try {
      const academicTermId = req.params.id as string;
      const request: CreateSemesterConfigType[] = req.body;
      const response = await SemesterService.bulkUpsertSemesters(
        academicTermId,
        request
      );
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
      return sendResponse({
        res,
        statusCode: 400,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getSemestersByTerm(req: Request, res: Response): Promise<void> {
    try {
      const academicTermId = req.params.id as string;
      const response = await SemesterService.getSemestersByTerm(academicTermId);
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
      return sendResponse({
        res,
        statusCode: 500,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }
}
