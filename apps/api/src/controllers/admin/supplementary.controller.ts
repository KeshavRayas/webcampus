import { SupplementaryService } from "@webcampus/api/src/services/admin/supplementary.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  AssignSupplementaryStudentsType,
  CreateSupplementaryOfferingType,
  CreateSupplementarySectionType,
  GetSupplementaryRegistrationsQueryType,
} from "@webcampus/schemas/admin";
import { Request, Response } from "express";

export class SupplementaryController {
  static async getOfferings(req: Request, res: Response): Promise<void> {
    try {
      const academicTermId = req.params.academicTermId as string;
      const response = await SupplementaryService.getOfferings(academicTermId);

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
      logger.error("Failed to fetch supplementary offerings", error);
      sendResponse({
        res,
        status: "error",
        statusCode:
          error instanceof Error && error.message === "Academic term not found"
            ? 404
            : 500,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async addOffering(req: Request, res: Response): Promise<void> {
    try {
      const response = await SupplementaryService.addOffering(
        req.body as CreateSupplementaryOfferingType
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
      logger.error("Failed to add supplementary offering", error);
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const notFound = ["not found"].some((needle) =>
        message.toLowerCase().includes(needle)
      );
      sendResponse({
        res,
        status: "error",
        statusCode: notFound ? 404 : 400,
        message,
        error,
      });
    }
  }

  static async removeOffering(req: Request, res: Response): Promise<void> {
    try {
      const response = await SupplementaryService.removeOffering(
        req.params.id as string
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
      logger.error("Failed to remove supplementary offering", error);
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        statusCode: message === "Supplementary offering not found" ? 404 : 400,
        message,
        error,
      });
    }
  }

  static async getRegistrations(req: Request, res: Response): Promise<void> {
    try {
      const response = await SupplementaryService.getRegistrations(
        req.query as unknown as GetSupplementaryRegistrationsQueryType
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
      logger.error("Failed to fetch supplementary registrations", error);
      sendResponse({
        res,
        status: "error",
        statusCode: 500,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async getDemandReport(req: Request, res: Response): Promise<void> {
    try {
      const academicTermId = req.params.academicTermId as string;
      const response =
        await SupplementaryService.getDemandReport(academicTermId);

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
      logger.error("Failed to fetch supplementary demand report", error);
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        statusCode: message === "Academic term not found" ? 404 : 400,
        message,
        error,
      });
    }
  }

  static async createSection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id?: string };
      const response = await SupplementaryService.createSupplementarySection(
        id as string,
        req.body as CreateSupplementarySectionType
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
      logger.error("Failed to create supplementary section", error);
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const lower = message.toLowerCase();
      const notFound =
        lower.includes("not found") || lower.includes("host semester");
      sendResponse({
        res,
        status: "error",
        statusCode: notFound ? 404 : 400,
        message,
        error,
      });
    }
  }

  static async getSections(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id?: string };
      const response = await SupplementaryService.getSupplementarySections(
        id as string
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
      logger.error("Failed to fetch supplementary sections", error);
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        statusCode: message === "Supplementary offering not found" ? 404 : 400,
        message,
        error,
      });
    }
  }

  static async assignStudents(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id?: string };
      const response = await SupplementaryService.assignStudents(
        id as string,
        req.body as AssignSupplementaryStudentsType
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
      logger.error(
        "Failed to place students into supplementary section",
        error
      );
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        statusCode: message === "Supplementary section not found" ? 404 : 400,
        message,
        error,
      });
    }
  }
}
