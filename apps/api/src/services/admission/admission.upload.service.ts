import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

const DOCUMENT_PREFIXES = {
  photo: "admission_photo_",
  aadharCard: "admission_aadhar_",
  class10thMarksPdf: "admission_10th_marks_",
  class12thMarksPdf: "admission_12th_marks_",
  diplomaMarksPdf: "admission_diploma_marks_",
  casteCertificate: "admission_caste_certificate_",
  disabilityCertificate: "admission_disability_certificate_",
  studyCertificate: "admission_study_certificate_",
  transferCertificate: "admission_transfer_certificate_",
  embassyPermissionLetter: "admission_embassy_permission_letter_",
} as const;

type DocumentField = keyof typeof DOCUMENT_PREFIXES;
type UploadedFiles = Partial<Record<DocumentField, Express.Multer.File[]>>;

export class AdmissionUploadService {
  static async uploadDocuments(
    admissionId: string,
    files: UploadedFiles
  ): Promise<BaseResponse<unknown>> {
    const selectedFields = (Object.keys(files) as DocumentField[]).filter(
      (field) => files[field]?.[0]
    );

    if (selectedFields.length === 0) {
      throw new Error("At least one document is required");
    }

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: {
        id: true,
        photo: true,
        aadharCard: true,
        class10thMarksPdf: true,
        class12thMarksPdf: true,
        diplomaMarksPdf: true,
        casteCertificate: true,
        disabilityCertificate: true,
        studyCertificate: true,
        transferCertificate: true,
        embassyPermissionLetter: true,
        nameAsPer10th: true,
        department: {
          select: { name: true },
        },
      },
    });

    if (!admission) {
      throw new Error("Admission not found");
    }

    const { deleteFromS3, generateFileName, uploadToS3 } = await import(
      "@webcampus/api/src/utils/s3"
    );
    const uploadedUrls: string[] = [];
    const nextUrls: Partial<Record<DocumentField, string>> = {};

    const rawDeptName = String(admission.department?.name || "unassigned");
    const deptName = rawDeptName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Use fullName to build studentName
    const fullName = admission.nameAsPer10th || "unknown";
    const studentName =
      fullName.toLowerCase().replace(/[^a-z0-9]/g, "") || "unknown";

    const prefixBase = `students/${deptName}/${studentName}_${admissionId}/`;

    try {
      for (const field of selectedFields) {
        const file = files[field]?.[0];
        if (!file) continue;

        const fileName = generateFileName(
          file.originalname,
          prefixBase + DOCUMENT_PREFIXES[field]
        );
        const result = await uploadToS3(file.buffer, fileName, file.mimetype);

        if (!result.success || !result.url) {
          throw new Error(`Failed to upload ${field}`);
        }

        nextUrls[field] = result.url;
        uploadedUrls.push(result.url);
      }

      const updateData: Prisma.AdmissionUpdateInput = {};
      for (const field of selectedFields) {
        const url = nextUrls[field];
        if (url) {
          updateData[field] = url;
        }
      }

      const updatedAdmission = await db.admission.update({
        where: { id: admissionId },
        data: updateData,
      });

      const oldUrls = selectedFields
        .map((field) => admission[field])
        .filter((url): url is string => Boolean(url));

      const cleanupResults = await Promise.allSettled(
        oldUrls.map((url) => deleteFromS3(url))
      );
      if (cleanupResults.some((result) => result.status === "rejected")) {
        logger.warn("Some replaced admission documents could not be deleted", {
          admissionId,
        });
      }

      return {
        status: "success",
        message: "Admission documents uploaded successfully",
        data: updatedAdmission,
      };
    } catch (error) {
      await Promise.allSettled(uploadedUrls.map((url) => deleteFromS3(url)));
      logger.error("Failed to upload admission documents", error);
      throw error;
    }
  }
}
