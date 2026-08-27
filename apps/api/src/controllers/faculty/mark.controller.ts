import {
  Mark,
  MarksExcelValidationError,
} from "@webcampus/api/src/services/faculty/mark.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { UpdateMarkType } from "@webcampus/schemas/faculty";
import { Request, Response } from "express";
import { CourseApprovalError } from "../../services/shared/course-approval";

const resolveSessionUser = async (req: Request) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) {
    throw new Error(ERRORS.UNAUTHENTICATED);
  }

  return session.user;
};

const errorMessageRequiresApproval = (message: string): boolean =>
  message === "Course has not been submitted for approval." ||
  message === "Course must be approved before this operation can be performed.";

const getStatusCodeForError = (message: string): number => {
  if (message === ERRORS.UNAUTHENTICATED || message === ERRORS.UNAUTHORIZED) {
    return 401;
  }
  if (errorMessageRequiresApproval(message)) {
    return 403;
  }
  if (message.toLowerCase().includes("not found")) {
    return 404;
  }
  return 400;
};

export class MarkController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Mark.create(req.body, user.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 201,
        });
      }
    } catch (error) {
      logger.error("Error creating mark:", { error });
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
      const ctx = (
        req as unknown as { requestContext?: { userId: string; role: string } }
      ).requestContext;
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const response = await Mark.getAll({
        page,
        limit,
        userId: ctx?.userId,
        role: ctx?.role,
      });
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
      logger.error("Error retrieving marks:", { error });
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
      const response = await Mark.getById(req.params.id);
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
      logger.error("Error retrieving mark:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getByStudentAndCourse(
    req: Request<{ studentId: string; courseId: string }>,
    res: Response
  ): Promise<void> {
    try {
      const ctx = (req as unknown as { requestContext?: { userId: string } })
        .requestContext;
      const response = await Mark.getByStudentAndCourse(
        req.params.studentId,
        req.params.courseId,
        ctx?.userId
      );
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
      logger.error("Error retrieving mark:", { error });
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async update(
    req: Request<{ id: string }, UpdateMarkType>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Mark.update(req.params.id, req.body, user.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: response.data ? 200 : 404,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: errorMessageRequiresApproval(response.message)
            ? 403
            : 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error updating mark:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode:
          error instanceof CourseApprovalError
            ? error.statusCode
            : error instanceof Error
              ? 400
              : 500,
        error,
      });
    }
  }

  static async delete(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const response = await Mark.delete(req.params.id, user.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: errorMessageRequiresApproval(response.message)
            ? 403
            : 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error deleting mark:", { error });
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode:
          error instanceof CourseApprovalError
            ? error.statusCode
            : error instanceof Error
              ? 400
              : 500,
        error,
      });
    }
  }

  static async getMarksDashboard(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const response = await Mark.getMarksDashboard(user.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error retrieving marks dashboard:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async getAssessmentWithMarks(
    req: Request<{ assessmentId: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const sectionId = req.query.sectionId as string | undefined;
      const electiveBatchId = req.query.electiveBatchId as string | undefined;
      const response = await Mark.getAssessmentTemplateWithMarks(
        user.id,
        req.params.assessmentId,
        sectionId,
        electiveBatchId
      );
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error retrieving assessment with marks:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async saveAssessmentMarks(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const response = await Mark.saveAssessmentMarks(user.id, req.body);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error saving assessment marks:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async downloadMarksTemplate(
    req: Request<{ assessmentId: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const sectionId = req.query.sectionId as string | undefined;
      const electiveBatchId = req.query.electiveBatchId as string | undefined;

      const buffer = await Mark.generateMarksTemplate(
        user.id,
        req.params.assessmentId,
        sectionId,
        electiveBatchId
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=marks_template_${req.params.assessmentId}.xlsx`
      );
      res.send(buffer);
    } catch (error) {
      logger.error("Error generating marks template:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async uploadMarksExcel(
    req: Request<{ assessmentId: string }>,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);
      const sectionId = req.body.sectionId as string | undefined;
      const electiveBatchId = req.body.electiveBatchId as string | undefined;
      if (!req.file) throw new Error("No file uploaded");

      const response = await Mark.uploadMarksFromExcel(
        user.id,
        req.params.assessmentId,
        sectionId,
        electiveBatchId,
        req.file.buffer
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
      logger.error("Error uploading marks excel:", { error });

      if (error instanceof MarksExcelValidationError) {
        res.status(400).json({
          status: "error",
          message: "Marks upload rejected",
          data: { errors: error.errors },
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async getMarksReport(req: Request, res: Response): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const courseId = req.query.courseId as string;
      const sectionId = req.query.sectionId as string | undefined;
      const assessmentId = req.query.assessmentId as string | undefined;
      const detailed = req.query.detailed === "true";

      if (!courseId) {
        sendResponse({
          res,
          status: "error",
          message: "courseId is required",
          statusCode: 400,
          error: "Missing courseId",
        });
        return;
      }

      const response = await Mark.getMarksReport(
        user.id,
        courseId,
        sectionId,
        assessmentId,
        detailed
      );
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error fetching marks report:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }

  static async getMarksReportFilterOptions(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = await resolveSessionUser(req);

      const response = await Mark.getMarksReportFilterOptions(user.id);
      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          message: response.message,
          data: response.data,
          statusCode: 200,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          message: response.message,
          statusCode: 400,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error fetching marks report filter options:", { error });
      const message =
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR;
      sendResponse({
        res,
        status: "error",
        message,
        statusCode: getStatusCodeForError(message),
        error,
      });
    }
  }
}
