import { AdmissionService } from "@webcampus/api/src/services/admission/admission.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  AdmissionActionParamType,
  CancelAdmissionType,
  ChangeAdmissionModeType,
  CreateAdmissionShellType,
  GetAdmissionReportsQueryType,
  GetAdmissionsQueryType,
  PortStudentsType,
} from "@webcampus/schemas/admission";
import { Request, Response } from "express";

export class AdmissionController {
  static async createShell(req: Request, res: Response): Promise<void> {
    try {
      const requestData = req.body as CreateAdmissionShellType;

      const response = await AdmissionService.createShell(
        requestData,
        req.headers
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
      logger.error("Error creating admission shell", error);
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

  static async getBySemester(req: Request, res: Response): Promise<void> {
    try {
      const { semesterId } = req.params;
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const filledById =
        session?.user?.role === "admission-instructor"
          ? session.user.id
          : undefined;

      const response = await AdmissionService.getAdmissionsBySemester(
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
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const filledById =
        session?.user?.role === "admission-instructor"
          ? session.user.id
          : undefined;

      const response = await AdmissionService.getAdmissions(
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

  static async getAdmissionReports(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const filledById =
        session?.user?.role === "admission-instructor"
          ? session.user.id
          : undefined;

      const response = await AdmissionService.getAdmissionReports(
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

  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const userId = session?.user?.id;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const admission = await db.admission.findFirst({
        where: {
          primaryEmail: user.email,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          semester: {
            include: {
              academicTerm: true,
            },
          },
          filledBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!admission) {
        throw new Error("Admission not found");
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Fetched applicant",
        data: admission,
      });
    } catch (error) {
      logger.error("Error fetching applicant profile", error);

      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 500,
        error,
      });
    }
  }
  static async deleteAdmission(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await AdmissionService.deleteAdmission(id as string);
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

  static async submit(req: Request, res: Response): Promise<void> {
    const uploadedFileUrls = new Set<string>();

    try {
      // 1. FOOLPROOF WAY: Get session directly from Better Auth
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const email = session?.user?.email;

      if (!email) {
        throw new Error("Unauthorized");
      }
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const fileUrls: { [key: string]: string } = {};

      const { uploadToS3, generateFileName } = await import(
        "@webcampus/api/src/utils/s3"
      );

      // Fetch existing admission ID or generate one if creating new
      const admissionRecord = await db.admission.findFirst({
        where: { primaryEmail: email },
        orderBy: { createdAt: "desc" },
        select: { id: true, department: { select: { name: true } } },
      });
      const admissionId = admissionRecord?.id;

      if (!admissionId) {
        throw new Error("Admission application not found.");
      }

      let fetchedDeptName: string | undefined =
        admissionRecord?.department?.name;
      if (!fetchedDeptName && req.body.departmentId) {
        const dept = await db.department.findUnique({
          where: { id: req.body.departmentId },
          select: { name: true },
        });
        fetchedDeptName = dept?.name;
      }

      // Build prefix
      const rawDeptName = String(
        req.body.branch ||
          req.body.departmentName ||
          fetchedDeptName ||
          "unassigned"
      );
      const deptName = rawDeptName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const fullName = String(req.body.nameAsPer10th || "unknown");
      const studentName =
        fullName.toLowerCase().replace(/[^a-z0-9]/g, "") || "unknown";

      const prefixBase = `students/${deptName}/${studentName}_${admissionId}/`;

      const handleUpload = async (field: string, prefix: string) => {
        if (files && files[field] && files[field][0]) {
          const file = files[field][0];
          const fileName = generateFileName(
            file.originalname,
            prefixBase + prefix
          );
          const result = await uploadToS3(file.buffer, fileName, file.mimetype);
          if (!result.success || !result.url) {
            throw new Error(`Failed to upload ${field}`);
          }

          fileUrls[field] = result.url;
          uploadedFileUrls.add(result.url);
        }
      };

      await Promise.all([
        handleUpload("class10thMarksPdf", "10th_marks_"),
        handleUpload("class12thMarksPdf", "12th_marks_"),
        handleUpload("diplomaMarksPdf", "diploma_marks_"),
        handleUpload("casteCertificate", "caste_cert_"),
        handleUpload("photo", "photo_"),
      ]);

      // 3. Submit to the service
      const response = await AdmissionService.submitApplication(
        email,
        req.body,
        fileUrls,
        req.headers,
        session.user.id
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
      if (uploadedFileUrls.size > 0) {
        try {
          const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
          await Promise.all(
            Array.from(uploadedFileUrls).map((url) => deleteFromS3(url))
          );
        } catch (cleanupError) {
          logger.warn("Failed to clean up uploaded admission files", {
            cleanupError,
            uploadedFileUrls: Array.from(uploadedFileUrls),
          });
        }
      }

      logger.error("Error submitting application", error);
      sendResponse({
        res,
        status: "error",
        message:
          error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
        statusCode:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 400,
        error,
      });
    }
  }

  static async staffSubmit(req: Request, res: Response): Promise<void> {
    const uploadedFileUrls = new Set<string>();

    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      const filledById = session?.user?.id;
      const primaryEmail = req.body.primaryEmail?.trim().toLowerCase();

      if (!filledById || !primaryEmail) {
        throw new Error("User and primary email are required");
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const fileUrls: { [key: string]: string } = {};
      const { uploadToS3, generateFileName } = await import(
        "@webcampus/api/src/utils/s3"
      );

      const { randomUUID } = await import("crypto");

      // Check if admission exists, else generate new ID for staff creation
      const admissionRecord = await db.admission.findFirst({
        where: { primaryEmail: primaryEmail },
        orderBy: { createdAt: "desc" },
        select: { id: true, department: { select: { name: true } } },
      });
      const admissionId = admissionRecord?.id ?? randomUUID();

      let fetchedDeptName: string | undefined =
        admissionRecord?.department?.name;
      if (!fetchedDeptName && req.body.departmentId) {
        const dept = await db.department.findUnique({
          where: { id: req.body.departmentId },
          select: { name: true },
        });
        fetchedDeptName = dept?.name;
      }

      // Build prefix
      const rawDeptName = String(
        req.body.branch ||
          req.body.departmentName ||
          fetchedDeptName ||
          "unassigned"
      );
      const deptName = rawDeptName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const fullName = String(req.body.nameAsPer10th || "unknown");
      const studentName =
        fullName.toLowerCase().replace(/[^a-z0-9]/g, "") || "unknown";

      const prefixBase = `students/${deptName}/${studentName}_${admissionId}/`;

      const handleUpload = async (field: string, prefix: string) => {
        if (files?.[field]?.[0]) {
          const file = files[field][0];
          const fileName = generateFileName(
            file.originalname,
            prefixBase + prefix
          );
          const result = await uploadToS3(file.buffer, fileName, file.mimetype);
          if (!result.success || !result.url) {
            throw new Error(`Failed to upload ${field}`);
          }
          fileUrls[field] = result.url;
          uploadedFileUrls.add(result.url);
        }
      };

      await Promise.all([
        handleUpload("class10thMarksPdf", "10th_marks_"),
        handleUpload("class12thMarksPdf", "12th_marks_"),
        handleUpload("diplomaMarksPdf", "diploma_marks_"),
        handleUpload("casteCertificate", "caste_cert_"),
        handleUpload("photo", "photo_"),
      ]);

      const response = await AdmissionService.createAndSubmitApplication(
        primaryEmail,
        req.body,
        fileUrls,
        filledById,
        req.headers,
        admissionId
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
      if (uploadedFileUrls.size > 0) {
        try {
          const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
          await Promise.all(
            Array.from(uploadedFileUrls).map((url) => deleteFromS3(url))
          );
        } catch (cleanupError) {
          logger.warn("Failed to clean up uploaded admission files", {
            cleanupError,
            uploadedFileUrls: Array.from(uploadedFileUrls),
          });
        }
      }

      logger.error("Error submitting staff application", error);
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

      const response = await AdmissionService.approveAdmission(
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
      const response = await AdmissionService.rejectAdmission(
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
      const response = await AdmissionService.changeAdmissionMode(
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
      const response = await AdmissionService.exitAdmission(
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

  static async cancelAdmission(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionService.cancelAdmission(
        req.params.id as string,
        req.body as CancelAdmissionType,
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
      logger.error("Error cancelling admission", error);
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
  static async portStudents(req: Request, res: Response): Promise<void> {
    try {
      const response = await AdmissionService.portStudents(
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
      const response = await AdmissionService.portAdmission(
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

  static async getFeeStructure(req: Request, res: Response): Promise<void> {
    try {
      const { departmentId, modeOfAdmission, categoryAllotted, quota } =
        req.query;

      if (!departmentId || !modeOfAdmission) {
        throw new Error("Department and mode of admission are required");
      }

      const response = await AdmissionService.getFeeStructure({
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
