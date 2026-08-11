import { ElectiveMappingService } from "@webcampus/api/src/services/department/elective-mapping.service";
import { OptimisticLockError } from "@webcampus/api/src/services/shared/audit.service";
import { getRequestContext } from "@webcampus/api/src/utils/request-context";
import { logger } from "@webcampus/common/logger";
import type {
  ElectiveMappingListQueryType,
  OverridePeCourseType,
  SaveElectiveMappingType,
  ValidateElectiveMappingCsvType,
} from "@webcampus/schemas/department";
import type { Request, Response } from "express";

export class ElectiveMappingController {
  static list = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as ElectiveMappingListQueryType;
      const ctx = getRequestContext(req);
      const isAdmin = ctx.role === "admin";
      const response = await ElectiveMappingService.listPeCourses(
        query.semesterId,
        ctx.userId,
        query.cycle,
        {
          requesterRole: isAdmin ? "admin" : "department",
          departmentId: query.departmentId,
          adminUserId: isAdmin ? ctx.userId : undefined,
        }
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ElectiveMappingController.list", { error });
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to list",
      });
    }
  };

  static detail = async (req: Request, res: Response) => {
    try {
      const courseId = req.params.courseId as string;
      const ctx = getRequestContext(req);
      const isAdmin = ctx.role === "admin";
      const departmentId = req.query.departmentId as string | undefined;
      const response = await ElectiveMappingService.getCourseDetail(
        courseId,
        ctx.userId,
        {
          requesterRole: isAdmin ? "admin" : "department",
          departmentId,
          adminUserId: isAdmin ? ctx.userId : undefined,
        }
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ElectiveMappingController.detail", { error });
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load detail",
      });
    }
  };

  static save = async (req: Request, res: Response) => {
    try {
      const body = req.body as SaveElectiveMappingType & {
        departmentId?: string;
      };
      const ctx = getRequestContext(req);
      const isAdmin = ctx.role === "admin";
      const response = await ElectiveMappingService.saveMapping(
        body,
        ctx.userId,
        {
          requesterRole: isAdmin ? "admin" : "department",
          departmentId: body.departmentId,
          adminUserId: isAdmin ? ctx.userId : undefined,
        }
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ElectiveMappingController.save", { error });
      if (error instanceof OptimisticLockError) {
        return res.status(409).json({
          status: "error",
          message: error.message,
          currentVersion: error.currentVersion,
        });
      }
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to save",
      });
    }
  };

  static validateCsv = async (req: Request, res: Response) => {
    try {
      const body = req.body as ValidateElectiveMappingCsvType & {
        departmentId?: string;
      };
      const ctx = getRequestContext(req);
      const isAdmin = ctx.role === "admin";
      const response = await ElectiveMappingService.validateCsv(
        body,
        ctx.userId,
        {
          requesterRole: isAdmin ? "admin" : "department",
          departmentId: body.departmentId,
          adminUserId: isAdmin ? ctx.userId : undefined,
        }
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ElectiveMappingController.validateCsv", { error });
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "CSV validation failed",
      });
    }
  };

  static overridePe = async (req: Request, res: Response) => {
    try {
      const body = req.body as OverridePeCourseType & { departmentId?: string };
      const ctx = getRequestContext(req);
      const isAdmin = ctx.role === "admin";
      const response = await ElectiveMappingService.overridePeCourse(
        body,
        ctx.userId,
        {
          requesterRole: isAdmin ? "admin" : "department",
          departmentId: body.departmentId,
          adminUserId: isAdmin ? ctx.userId : undefined,
        }
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ElectiveMappingController.overridePe", { error });
      if (error instanceof OptimisticLockError) {
        return res.status(409).json({
          status: "error",
          message: error.message,
          currentVersion: error.currentVersion,
        });
      }
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Override failed",
      });
    }
  };

  static renameBatch = async (req: Request, res: Response) => {
    try {
      const { electiveBatchId, name, departmentId } = req.body as {
        electiveBatchId: string;
        name: string;
        departmentId?: string;
      };
      const ctx = getRequestContext(req);
      const isAdmin = ctx.role === "admin";
      const response = await ElectiveMappingService.renameBatch(
        electiveBatchId,
        name,
        ctx.userId,
        {
          requesterRole: isAdmin ? "admin" : "department",
          departmentId,
          adminUserId: isAdmin ? ctx.userId : undefined,
        }
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ElectiveMappingController.renameBatch", { error });
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Rename failed",
      });
    }
  };

  static deleteBatch = async (req: Request, res: Response) => {
    try {
      const { electiveBatchId, departmentId } = req.body as {
        electiveBatchId: string;
        departmentId?: string;
      };
      const ctx = getRequestContext(req);
      const isAdmin = ctx.role === "admin";
      const response = await ElectiveMappingService.deleteBatch(
        electiveBatchId,
        ctx.userId,
        {
          requesterRole: isAdmin ? "admin" : "department",
          departmentId,
          adminUserId: isAdmin ? ctx.userId : undefined,
        }
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ElectiveMappingController.deleteBatch", { error });
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Delete failed",
      });
    }
  };
}
