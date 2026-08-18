import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { GetAdmissionReportsQueryType } from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";
import { buildAdmissionWhere } from "./admission.shared";

export class AdmissionReportService {
  static async getAdmissionReports(
    filters: GetAdmissionReportsQueryType,
    filledById?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const page = Math.max(Number(filters.page) || 0, 0);
      const pageSize = Math.min(
        Math.max(Number(filters.pageSize) || 10, 1),
        100
      );
      const where = buildAdmissionWhere(filters, filledById);

      const [total, items] = await Promise.all([
        db.admission.count({ where }),
        db.admission.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: page * pageSize,
          take: pageSize,
          select: {
            id: true,
            applicationId: true,
            primaryEmail: true,
            status: true,
            createdAt: true,
            departmentId: true,
            modeOfAdmission: true,
            categoryClaimed: true,
            categoryAllotted: true,
            quota: true,
            admissionType: true,
            admissionBasedOn: true,
            hostel: true,
            counsellingRound: true,
            feeStatus: true,
            feePaid: true,
            feeReceiptNumber: true,
            semesterId: true,
            studentId: true,
            nameAsPer10th: true,
            department: { select: { name: true } },
            student: {
              select: {
                usn: true,
                user: { select: { name: true } },
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
            cancellation: {
              select: {
                reason: true,
                description: true,
                cancelledAt: true,
              },
            },
          },
        }),
      ]);

      return {
        status: "success",
        message: "Report data fetched successfully",
        data: { items, total, page, pageSize },
      };
    } catch (error) {
      logger.error("Failed to fetch report data", error);
      throw error;
    }
  }
}
