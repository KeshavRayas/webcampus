import { AdmissionCreateService } from "@webcampus/api/src/services/admission/admission-create.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { CreateAdmissionShellType } from "@webcampus/schemas/admission";
import { Request, Response } from "express";

export class AdmissionCreateController {
  static async createShell(req: Request, res: Response): Promise<void> {
    try {
      const requestData = req.body as CreateAdmissionShellType;

      const response = await AdmissionCreateService.createShell(
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

  static async submit(req: Request, res: Response): Promise<void> {
    const uploadedFileUrls = new Set<string>();

    try {
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

      const response = await AdmissionCreateService.submitApplication(
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

      const response = await AdmissionCreateService.createAndSubmitApplication(
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
}
