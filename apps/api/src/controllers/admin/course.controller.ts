import { AdminCourseService } from "@webcampus/api/src/services/admin/course.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type {
  AdminCourseBranchQueryType,
  AdminCourseByIdQueryType,
} from "@webcampus/schemas/admin";
import type { UUIDType } from "@webcampus/schemas/common";
import type {
  CreateCourseDTO,
  DeleteCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import type { Request, Response } from "express";
import { CourseApprovalError } from "../../services/shared/course-approval";

// import { GetBucketEncryptionRequest$ } from "@aws-sdk/client-s3";

export class AdminCourseController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateCourseDTO = req.body;
      const response = await AdminCourseService.create(request);

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
      logger.error("Error creating admin course", error);
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

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user?.id) throw new Error("Unauthorized");

      const request: UpdateCourseDTO & { version?: number; reason?: string } =
        req.body;

      const response = await AdminCourseService.update(request, {
        isAdmin: true,
        adminUserId: session.user.id,
        clientVersion: request.version,
        reason: request.reason,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
      });

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
      logger.error("Error updating admin course", error);
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

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user?.id) throw new Error("Unauthorized");

      const request: DeleteCourseDTO = req.body;
      const response = await AdminCourseService.delete(request.id);

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
      logger.error("Error deleting admin course", error);
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

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const request = req.params as UUIDType;
      const { departmentId, departmentName } =
        req.query as AdminCourseByIdQueryType;
      const response = await AdminCourseService.getById(
        request.id,
        departmentId,
        departmentName
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
      logger.error("Error fetching admin course", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode:
          error instanceof CourseApprovalError
            ? error.statusCode
            : error instanceof Error
              ? 404
              : 500,
        error,
      });
    }
  }

  static async getByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { departmentId, departmentName, semesterId, cycle } =
        req.query as AdminCourseBranchQueryType;

      let resolvedDepartmentId = departmentId;
      let resolvedDepartmentName = departmentName;

      if (!resolvedDepartmentId && resolvedDepartmentName) {
        let department = await db.department.findFirst({
          where: {
            name: { equals: resolvedDepartmentName, mode: "insensitive" },
          },
          select: { id: true, name: true },
        });

        if (!department) {
          const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, "");
          const target = normalise(resolvedDepartmentName);
          const allDepartments = await db.department.findMany({
            select: { id: true, name: true },
          });
          department =
            allDepartments.find((d) => normalise(d.name) === target) ?? null;
        }

        if (department) {
          resolvedDepartmentId = department.id;
          resolvedDepartmentName = department.name;
        }
      }

      const response = await AdminCourseService.getByDepartment(
        resolvedDepartmentId,
        resolvedDepartmentId ? undefined : resolvedDepartmentName,
        semesterId,
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
      logger.error("Error fetching admin courses by department", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: error instanceof CourseApprovalError ? 403 : 500,
        error,
      });
    }
  }

  static async getCoordinators(req: Request, res: Response): Promise<void> {
    try {
      const courseId = req.params.id as string;
      const response = await AdminCourseService.getCoordinators(courseId);

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
      logger.error("Error fetching admin course coordinators", error);
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

  static async updateCoordinators(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user?.id) throw new Error("Unauthorized");

      const { facultyIds, version, reason } = req.body as {
        facultyIds: string[];
        version?: number;
        reason?: string;
      };

      const courseId = req.params.id as string;

      const response = await AdminCourseService.updateCoordinators(
        courseId,
        facultyIds,
        {
          isAdmin: true,
          adminUserId: session.user.id,
          clientVersion: version,
          reason,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers["user-agent"],
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
      logger.error("Error updating admin course coordinators", error);
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

  static async getMappedFaculty(req: Request, res: Response): Promise<void> {
    try {
      const courseId = req.params.id as string;
      const response =
        await AdminCourseService.getMappedFacultyForCourse(courseId);

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
      logger.error("Error fetching admin mapped faculty", error);
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
