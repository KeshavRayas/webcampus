import {
  ProjectMappingExcelValidationError,
  ProjectMappingService,
} from "@webcampus/api/src/services/department/project-mapping.service";
import { OptimisticLockError } from "@webcampus/api/src/services/shared/audit.service";
import { getRequestContext } from "@webcampus/api/src/utils/request-context";
import { logger } from "@webcampus/common/logger";
import type {
  ProjectMappingBulkAssign,
  ProjectMappingGroupsQuery,
  ProjectMappingListQuery,
  ProjectMappingSave,
  ProjectMappingSaveFaculty,
} from "@webcampus/schemas/department";
import type { Request, Response } from "express";

function buildContext(req: Request) {
  const ctx = getRequestContext(req);
  const isAdmin = ctx.role === "admin";
  const departmentId =
    (req.query.departmentId as string | undefined) ??
    (req.body?.departmentId as string | undefined);
  return {
    ctx,
    isAdmin,
    context: {
      requesterRole: isAdmin ? ("admin" as const) : ("department" as const),
      departmentId,
      adminUserId: isAdmin ? ctx.userId : undefined,
    },
  };
}

export class ProjectMappingController {
  static list = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as ProjectMappingListQuery;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.listCourses(
        query.semesterId,
        ctx.userId,
        query.cycle,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.list", { error });
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to list",
      });
    }
  };

  static detail = async (req: Request, res: Response) => {
    try {
      const courseId = req.params.courseId as string;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.getCourseDetail(
        courseId,
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.detail", { error });
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to fetch",
      });
    }
  };

  static getGroups = async (req: Request, res: Response) => {
    try {
      const courseId = req.params.courseId as string;
      const query = req.query as unknown as ProjectMappingGroupsQuery;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.getGroups(
        courseId,
        {
          page: query.page,
          limit: query.limit,
          search: query.search,
          status: query.status,
          facultyId: query.facultyId,
          sectionId: query.sectionId,
        },
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.getGroups", { error });
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch groups",
      });
    }
  };

  static getGroupDetail = async (req: Request, res: Response) => {
    try {
      const courseId = req.params.courseId as string;
      const groupId = req.params.groupId as string;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.getGroupDetail(
        courseId,
        groupId,
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.getGroupDetail", { error });
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch group",
      });
    }
  };

  static saveAssignments = async (req: Request, res: Response) => {
    try {
      const body = req.body as ProjectMappingSave;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.saveAssignments(
        body,
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.saveAssignments", { error });
      if (error instanceof OptimisticLockError) {
        res.status(409).json({
          status: "error",
          message: error.message,
          currentVersion: error.currentVersion,
        });
        return;
      }
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to save",
      });
    }
  };

  static saveFaculty = async (req: Request, res: Response) => {
    try {
      const body = req.body as ProjectMappingSaveFaculty;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.saveFaculty(
        body,
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.saveFaculty", { error });
      if (error instanceof OptimisticLockError) {
        res.status(409).json({
          status: "error",
          message: error.message,
          currentVersion: error.currentVersion,
        });
        return;
      }
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save faculty mapping",
      });
    }
  };

  static bulkAssign = async (req: Request, res: Response) => {
    try {
      const body = req.body as ProjectMappingBulkAssign;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.bulkAssign(
        body,
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.bulkAssign", { error });
      if (error instanceof OptimisticLockError) {
        res.status(409).json({
          status: "error",
          message: error.message,
          currentVersion: error.currentVersion,
        });
        return;
      }
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to bulk assign",
      });
    }
  };

  static saveFullMapping = async (req: Request, res: Response) => {
    try {
      const body = req.body as ProjectMappingSave;
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.saveFullMapping(
        body,
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.saveFullMapping", { error });
      if (error instanceof OptimisticLockError) {
        res.status(409).json({
          status: "error",
          message: error.message,
          currentVersion: error.currentVersion,
        });
        return;
      }
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to save mapping",
      });
    }
  };

  static downloadTemplate = async (req: Request, res: Response) => {
    try {
      const courseId = req.params.courseId as string;
      const { ctx, context } = buildContext(req);
      const buffer = await ProjectMappingService.generateTemplate(
        courseId,
        ctx.userId,
        context
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=project_mapping_template.xlsx`
      );
      res.send(buffer);
    } catch (error) {
      logger.error("ProjectMappingController.downloadTemplate", { error });
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to download template",
      });
    }
  };

  static validateUpload = async (req: Request, res: Response) => {
    try {
      const courseId = req.params.courseId as string;
      if (!req.file) {
        throw new Error("No file uploaded");
      }
      const { ctx, context } = buildContext(req);
      const response = await ProjectMappingService.validateUpload(
        courseId,
        req.file.buffer,
        ctx.userId,
        context
      );
      res.status(200).json(response);
    } catch (error) {
      logger.error("ProjectMappingController.validateUpload", { error });
      if (error instanceof ProjectMappingExcelValidationError) {
        res.status(400).json({
          status: "error",
          message: "Excel validation failed",
          data: { errors: error.errors },
        });
        return;
      }
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Excel validation failed",
      });
    }
  };
}
