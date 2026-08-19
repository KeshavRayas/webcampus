import { AdmissionViewService } from "@webcampus/api/src/services/admission/admission-view.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import {
  AdmissionActionParamType,
  ChangeAdmissionModeType,
  GetAdmissionsQueryType,
  PortStudentsType,
} from "@webcampus/schemas/admission";
import { Request, Response } from "express";

const getFilledById = async (req: Request): Promise<string | undefined> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return session?.user?.role === "admission-instructor"
    ? session.user.id
    : undefined;
};

export class AdmissionViewController {
  static async getBySemester(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId } = req.params;
      const filledById = await getFilledById(req);

      const response = await AdmissionViewService.getAdmissionsBySemester(
        semesterId as string,
        filledById
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
      logger.error("Error fetching admissions", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async getAdmissions(req: Request, res: Response): Promise<void> {
    try {
      const filledById = await getFilledById(req);

      const response = await AdmissionViewService.getAdmissions(
        req.query as GetAdmissionsQueryType,
        filledById
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
      logger.error("Error fetching admissions", error);
      sendResponse({
        res,
        status: "error",
        message: ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 500,
        error,
      });
    }
  }

  static async deleteAdmission(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await AdmissionViewService.deleteAdmission(id as string);
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
      logger.error("Error deleting admission", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async approve(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as { feePaid?: number; feeReceiptNumber?: string };

      const response = await AdmissionViewService.approveAdmission(
        req.params as AdmissionActionParamType,
        {
          feePaid:
            body.feePaid !== undefined ? Number(body.feePaid) : undefined,
          feeReceiptNumber: body.feeReceiptNumber,
        }
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
      logger.error("Error approving admission", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async reject(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionViewService.rejectAdmission(
        req.params as AdmissionActionParamType
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
      logger.error("Error rejecting admission", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async changeAdmissionMode(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionViewService.changeAdmissionMode(
        req.params.id as string,
        req.body as ChangeAdmissionModeType
      );

      if (response.status === "success") {
        sendResponse({
          res,
          status: "success",
          statusCode: 200,
          message: response.message,
          data: response.data,
        });
      } else {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: response.message,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error changing admission mode", error);

      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async exitAdmission(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionViewService.exitAdmission(
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
      } else {
        sendResponse({
          res,
          status: "error",
          statusCode: 400,
          message: response.message,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error("Error exiting admission", error);

      sendResponse({
        res,
        status: "error",
        statusCode: 400,
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        error,
      });
    }
  }

  static async portStudents(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionViewService.portStudents(
        req.body as PortStudentsType,
        req.headers
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
      logger.error("Error porting students", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }

  static async portAdmission(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionViewService.portAdmission(
        req.params.id as string,
        req.headers
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
      logger.error("Error porting admission", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode: 400,
        error,
      });
    }
  }
}
