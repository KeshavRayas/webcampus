import { getRequestContext } from "@webcampus/api/src/utils/request-context";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class ProctorController {
  static async getStudents(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getRequestContext(req);
      const { db } = await import("@webcampus/db");

      const faculty = await db.faculty.findUnique({
        where: { userId: requestContext.userId },
      });
      if (!faculty) {
        sendResponse({
          res,
          status: "error",
          statusCode: 404,
          message: "Faculty not found",
          error: new Error("Faculty not found"),
        });
        return;
      }

      const groups = await db.proctorGroup.findMany({
        where: { facultyId: faculty.id },
        include: {
          students: {
            include: {
              user: { select: { name: true, email: true } },
              studentSections: { include: { section: true } },
            },
            orderBy: { usn: "asc" },
          },
        },
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Students fetched",
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
}
