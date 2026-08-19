import { AdmissionFeeService } from "@webcampus/api/src/services/admission/admission-fee.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

export class AdmissionFeeController {
  static async getFeeStructure(req: Request, res: Response): Promise<void> {
    try {
      const { departmentId, modeOfAdmission, categoryAllotted, quota } =
        req.query;

      if (!departmentId || !modeOfAdmission) {
        throw new Error("Department and mode of admission are required");
      }

      const response = await AdmissionFeeService.getFeeStructure({
        departmentId: String(departmentId),
        modeOfAdmission: String(modeOfAdmission),
        categoryAllotted: categoryAllotted
          ? String(categoryAllotted)
          : undefined,
        quota: quota ? String(quota) : undefined,
      });

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
      logger.error("Error fetching fee structure", error);
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
