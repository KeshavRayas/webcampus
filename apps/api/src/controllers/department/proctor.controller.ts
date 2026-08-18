import { getDepartmentRequestContext } from "@webcampus/api/src/utils/request-context";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";
import { ProctorService } from "../../services/department/proctor.service";

export class ProctorController {
  static async getAllGroups(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getDepartmentRequestContext(req);
      const { db } = await import("@webcampus/db");

      const department = await db.department.findUnique({
        where: { id: requestContext.departmentId },
      });

      if (department?.type !== "DEGREE_GRANTING") {
        sendResponse({
          res,
          status: "error",
          statusCode: 403,
          message:
            "Proctor mapping is only available for degree granting departments.",
          error: new Error("Not degree granting"),
        });
        return;
      }

      const { semesterId } = req.query as { semesterId?: string };

      const where: Record<string, unknown> = {
        departmentId: requestContext.departmentId,
      };
      if (semesterId) {
        where.semesterId = semesterId;
      }

      const groups = await db.proctorGroup.findMany({
        where,
        include: { faculty: true, _count: { select: { students: true } } },
        orderBy: { groupNumber: "asc" },
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Groups fetched",
        data: groups,
      });
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

  static async createGroup(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getDepartmentRequestContext(req);
      const { db } = await import("@webcampus/db");
      const { groupNumber, semesterId } = req.body;

      if (!groupNumber) {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: "Group number is required.",
          error: new Error("Missing groupNumber"),
        });
        return;
      }

      // Prefix with PR- if not already starting with PR- (from requirements)
      const formattedGroupNumber = groupNumber
        .toString()
        .toUpperCase()
        .startsWith("PR-")
        ? groupNumber.toString().toUpperCase()
        : `PR-${groupNumber}`;

      // Because semesterId might be null, we find using where
      const existing = await db.proctorGroup.findFirst({
        where: {
          departmentId: requestContext.departmentId,
          semesterId: semesterId || null,
          groupNumber: formattedGroupNumber,
        },
      });

      if (existing) {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: "Group number already exists.",
          error: new Error("Exists"),
        });
        return;
      }

      const group = await db.proctorGroup.create({
        data: {
          departmentId: requestContext.departmentId,
          semesterId: semesterId || null,
          groupNumber: formattedGroupNumber,
        },
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: "Group created",
        data: group,
      });
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

  static async assignFaculty(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getDepartmentRequestContext(req);
      const { db } = await import("@webcampus/db");
      const { facultyId } = req.body;
      const id = req.params.id as string;

      if (facultyId) {
        const faculty = await db.faculty.findFirst({
          where: { id: facultyId, departmentId: requestContext.departmentId },
        });
        if (!faculty) {
          sendResponse({
            res,
            status: "error",
            statusCode: 400,
            message: "Faculty not found in this department.",
            error: new Error("Not found"),
          });
          return;
        }
      }

      const group = await db.proctorGroup.update({
        where: { id, departmentId: requestContext.departmentId },
        data: { facultyId: facultyId || null },
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Faculty assigned",
        data: group,
      });
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

  static async deleteGroup(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getDepartmentRequestContext(req);
      const { db } = await import("@webcampus/db");
      const id = req.params.id as string;

      await db.proctorGroup.delete({
        where: { id, departmentId: requestContext.departmentId },
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Group deleted",
        data: null,
      });
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

  static async getStudents(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getDepartmentRequestContext(req);
      const { db } = await import("@webcampus/db");

      const { semesterId } = req.query as { semesterId?: string };

      const where: Record<string, unknown> = {
        departmentName: requestContext.departmentName,
      };
      if (semesterId) {
        where.semesterId = semesterId;
      }

      const students = await db.student.findMany({
        where,
        select: {
          id: true,
          usn: true,
          user: { select: { name: true } },
          proctorGroupId: true,
          semesterNumber: true,
        },
        orderBy: { usn: "asc" },
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Students fetched",
        data: students,
      });
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

  static async assignStudents(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getDepartmentRequestContext(req);
      const { db } = await import("@webcampus/db");
      const { studentIds, proctorGroupId } = req.body;

      if (!Array.isArray(studentIds)) {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: "studentIds must be an array.",
          error: new Error("Not array"),
        });
        return;
      }

      if (proctorGroupId) {
        const group = await db.proctorGroup.findFirst({
          where: {
            id: proctorGroupId,
            departmentId: requestContext.departmentId,
          },
        });
        if (!group) {
          sendResponse({
            res,
            status: "error",
            statusCode: 400,
            message: "Proctor group not found.",
            error: new Error("Not found"),
          });
          return;
        }
      }

      await db.student.updateMany({
        where: {
          id: { in: studentIds },
          departmentName: requestContext.departmentName,
        },
        data: { proctorGroupId: proctorGroupId || null },
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Students assigned successfully",
        data: null,
      });
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

  static async generateGroups(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getDepartmentRequestContext(req);
      const { semesterId, studentsPerGroup, action } = req.body;

      if (!semesterId || !studentsPerGroup || !action) {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: "semesterId, studentsPerGroup, and action are required.",
          error: new Error("Missing parameters"),
        });
        return;
      }

      const result = await ProctorService.generateProctorGroups({
        departmentId: requestContext.departmentId,
        departmentName: requestContext.departmentName || "",
        semesterId,
        studentsPerGroup,
        action,
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      logger.error({ error });
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
}
