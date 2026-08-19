import { AdmissionReportService } from "@webcampus/api/src/services/admission/admission-report.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { GetAdmissionReportsQueryType } from "@webcampus/schemas/admission";
import { Request, Response } from "express";

export class AdmissionReportController {
  static async getAdmissionReports(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const filledById =
        session?.user?.role === "admission-instructor"
          ? session.user.id
          : undefined;

      const response = await AdmissionReportService.getAdmissionReports(
        req.query as GetAdmissionReportsQueryType,
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
      logger.error("Error fetching admission report data", error);
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
