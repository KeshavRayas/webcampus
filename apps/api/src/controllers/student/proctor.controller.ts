import { getRequestContext } from "@webcampus/api/src/utils/request-context";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class ProctorController {
  static async getProctor(req: Request, res: Response): Promise<void> {
    try {
      const requestContext = await getRequestContext(req);
      const { db } = await import("@webcampus/db");

      const student = await db.student.findUnique({
        where: { userId: requestContext.userId },
        include: {
          proctorGroup: {
            include: {
              faculty: {
                include: {
                  user: { select: { name: true, email: true, image: true } },
                },
              },
            },
          },
        },
      });

      if (!student) {
        sendResponse({
          res,
          status: "error",
          statusCode: 404,
          message: "Student not found",
          error: new Error("Student not found"),
        });
        return;
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Proctor fetched",
        data: student.proctorGroup,
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
