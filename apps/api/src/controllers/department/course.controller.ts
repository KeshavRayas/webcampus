import { CourseService } from "@webcampus/api/src/services/department/course.service";
import { getDepartmentRequestContext } from "@webcampus/api/src/utils/request-context";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { UUIDType } from "@webcampus/schemas/common";
import {
  CreateCourseDTO,
  DeleteCourseDTO,
  UpdateCoordinatorsBodyDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import { Request, Response } from "express";

export class CourseController {
  private static getApprovalErrorStatusCode(error: unknown): number {
    if (!(error instanceof Error)) {
      return 500;
    }

    if (error.message.includes("Unauthorized")) {
      return 401;
    }

    if (error.message.includes("Forbidden")) {
      return 403;
    }

    if (error.message.startsWith("Failed to approve")) {
      return 500;
    }

    if (error.message.startsWith("Failed to request revision")) {
      return 500;
    }

    if (
      error.message === "Role is required for approval" ||
      error.message === "Role is required for requesting revision" ||
      error.message === "Department not found" ||
      error.message === "Ambiguous departmentName mapping" ||
      error.message === "departmentId and departmentName do not match" ||
      error.message === "departmentId is required"
    ) {
      return 400;
    }

    return 500;
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateCourseDTO = req.body;
      const departmentContext = await getDepartmentRequestContext(req);
      logger.debug("Creating Course", request);
      const response = await CourseService.create(
        {
          ...request,
          departmentId: departmentContext.departmentId,
        },
        departmentContext
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
      logger.error("Error Creating Course", error);
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const request: UpdateCourseDTO = req.body;
      const departmentContext = await getDepartmentRequestContext(req);
      logger.debug("Updating Course", request);
      const response = await CourseService.update(
        {
          ...request,
          departmentId: departmentContext.departmentId,
        },
        departmentContext
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
      logger.error("Error Updating Course", error);
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
      const request: DeleteCourseDTO = req.body;
      const departmentContext = await getDepartmentRequestContext(req);
      logger.debug("Deleting Course", request);
      const response = await CourseService.delete(
        request.id,
        departmentContext
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
      logger.error("Error Deleting Course", error);
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
      const departmentContext = await getDepartmentRequestContext(req);
      const response = await CourseService.getById(
        request.id,
        departmentContext
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
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const statusCode = message === "Course not found" ? 404 : 500;

      logger.error("Error Fetching Course", error);
      sendResponse({
        res,
        status: "error",
        message,
        statusCode,
        error,
      });
    }
  }

  static async getByBranch(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId, cycle } = req.query as {
        semesterId?: string;
        cycle?: string;
      };
      const departmentContext = await getDepartmentRequestContext(req);

      // PERFECTLY ALIGNED SIGNATURE
      const response = await CourseService.getByBranch(
        semesterId as string,
        departmentContext.departmentId,
        undefined,
        cycle,
        departmentContext
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
      logger.error("Error Fetching Courses by Branch", error);
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: error instanceof Error ? 400 : 500,
        error,
      });
    }
  }

  static async bulkSubmitForApproval(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { semesterId, cycle } = req.body;
      const departmentContext = await getDepartmentRequestContext(req);

      const response = await CourseService.bulkSubmitForApproval(
        semesterId,
        departmentContext.departmentId,
        undefined,
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
      logger.error("Error submitting courses for approval", error);
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

  static async getGroupedCourseSubmissions(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const role = session?.user?.role as "admin" | "coe";

      const response = await CourseService.getGroupedCourseSubmissions(role);

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
      logger.error("Error Fetching Grouped Course Submissions", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async approveSemesterCourses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user?.id || !session?.user?.role) {
        throw new Error("Unauthorized");
      }

      const { semesterId, departmentId, departmentName, cycle } = req.body;

      // PERFECTLY ALIGNED SIGNATURE
      const response = await CourseService.approveSemesterCourses(
        semesterId,
        departmentId,
        departmentName,
        cycle,
        session.user.role as "admin" | "coe",
        session.user.username ?? undefined,
        session.user.displayUsername ?? undefined
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
      logger.error("Error Approving Courses", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: CourseController.getApprovalErrorStatusCode(error),
        error,
      });
    }
  }

  static async requestRevisionForSemester(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user?.id || !session?.user?.role) {
        throw new Error("Unauthorized");
      }

      const { semesterId, departmentId, departmentName, reviewerNotes, cycle } =
        req.body;

      // PERFECTLY ALIGNED SIGNATURE (reviewerNotes is 2nd argument)
      const response = await CourseService.requestRevisionForSemester(
        semesterId,
        departmentId,
        departmentName,
        reviewerNotes,
        cycle,
        session.user.role as "admin" | "coe"
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
      logger.error("Error Requesting Revision for Courses", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: CourseController.getApprovalErrorStatusCode(error),
        error,
      });
    }
  }

  static async getCoordinators(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as UUIDType;
      const departmentContext = await getDepartmentRequestContext(req);
      const response = await CourseService.getCoordinators(
        id,
        departmentContext
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
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const statusCode = message === "Course not found" ? 404 : 500;

      logger.error("Error Fetching Coordinators", error);
      sendResponse({
        res,
        status: "error",
        message,
        statusCode,
        error,
      });
    }
  }

  static async updateCoordinators(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as UUIDType;
      const { facultyIds }: UpdateCoordinatorsBodyDTO = req.body;
      const departmentContext = await getDepartmentRequestContext(req);

      const response = await CourseService.updateCoordinators(
        id,
        facultyIds,
        departmentContext
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
      logger.error("Error Updating Coordinators", error);
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
      const { id } = req.params as UUIDType;
      const departmentContext = await getDepartmentRequestContext(req);
      const response = await CourseService.getMappedFacultyForCourse(
        id,
        departmentContext
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
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      const statusCode = message === "Course not found" ? 404 : 500;

      logger.error("Error Fetching Mapped Faculty", error);
      sendResponse({
        res,
        status: "error",
        message,
        statusCode,
        error,
      });
    }
  }
}
