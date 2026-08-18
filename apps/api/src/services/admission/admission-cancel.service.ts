import { IncomingHttpHeaders } from "http";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { CancelAdmissionType } from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";

export class AdmissionCancelService {
  static async cancelAdmission(
    id: string,
    data: CancelAdmissionType,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(headers),
      });
      const cancelledById = session?.user?.id;

      if (!cancelledById) {
        throw new Error("Unauthorized");
      }

      const reason =
        data.reason === "OTHER"
          ? `OTHER: ${data.otherReason!.trim()}`
          : data.reason;

      const result = await db.$transaction(async (tx) => {
        const admission = await tx.admission.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            studentId: true,
            primaryEmail: true,
          },
        });

        if (!admission) {
          throw new Error("Admission not found");
        }

        if (admission.status === "CANCELLED") {
          throw new Error("Admission has already been cancelled");
        }

        if (admission.status === "PORTED" || admission.studentId) {
          throw new Error(
            "Cannot cancel an admission that has already been ported"
          );
        }

        const existingCancellation = await tx.cancelledAdmissions.findUnique({
          where: { admissionId: id },
        });

        if (existingCancellation) {
          throw new Error("Admission has already been cancelled");
        }

        const cancellation = await tx.cancelledAdmissions.create({
          data: {
            admissionId: id,
            reason,
            description: data.description?.trim() || null,
            cancelledById,
          },
          include: {
            admission: true,
            cancelledBy: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        await tx.admission.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        const applicantUser = await tx.user.findFirst({
          where: { email: admission.primaryEmail, role: "applicant" },
          select: { id: true, email: true },
        });

        if (applicantUser) {
          const atIndex = applicantUser.email.lastIndexOf("@");
          const localPart =
            atIndex >= 0
              ? applicantUser.email.slice(0, atIndex)
              : applicantUser.email;
          const domain = atIndex >= 0 ? applicantUser.email.slice(atIndex) : "";
          const suffixedEmail = `${localPart}-cancelled-${Date.now()}${domain}`;

          await tx.user.update({
            where: { id: applicantUser.id },
            data: { email: suffixedEmail },
          });
        }

        return cancellation;
      });

      return {
        status: "success",
        message: "Admission cancelled successfully",
        data: result,
      };
    } catch (error) {
      logger.error("Failed to cancel admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to cancel admission"
      );
    }
  }
}
