import { db } from "@webcampus/db";
import type {
  MessageCategory,
  MessageScope,
  SendConfigType,
} from "@webcampus/schemas/admin";
import type { RecipientTarget } from "./recipients.service";

export type TargetStatus = "SUCCESS" | "FAILURE" | "SKIPPED";

export type CampaignTarget = RecipientTarget & {
  status: TargetStatus;
  errorMessage?: string;
};

export type CampaignCounts = {
  total: number;
  success: number;
  failure: number;
  skipped: number;
};

export async function persistCampaign(input: {
  config: SendConfigType;
  category: MessageCategory;
  scope: MessageScope;
  studentTemplateId?: string;
  parentTemplateId?: string;
  sentById: string;
  targets: CampaignTarget[];
  providerResponse: unknown;
}): Promise<{ campaignId: string; counts: CampaignCounts }> {
  const counts: CampaignCounts = {
    total: input.targets.length,
    success: input.targets.filter((t) => t.status === "SUCCESS").length,
    failure: input.targets.filter((t) => t.status === "FAILURE").length,
    skipped: input.targets.filter((t) => t.status === "SKIPPED").length,
  };

  const campaign = await db.messageCampaign.create({
    data: {
      channel: "WHATSAPP",
      category: input.category,
      scope: input.scope,
      filterSnapshot: {
        academicTermId: input.config.academicTermId ?? null,
        departmentId: input.config.departmentId ?? null,
        semesterId: input.config.semesterId ?? null,
        sectionIds: input.config.sectionIds ?? [],
        cieNumber: input.config.cieNumber ?? null,
        subjectIds: input.config.subjectIds ?? [],
      },
      adHocData: input.config.adHocData ?? undefined,
      studentTemplateId: input.studentTemplateId ?? null,
      parentTemplateId: input.parentTemplateId ?? null,
      sentById: input.sentById,
      totalReceivers: counts.total,
      successCount: counts.success,
      failureCount: counts.failure,
      skippedCount: counts.skipped,
      providerResponse: input.providerResponse ?? undefined,
    },
  });

  if (input.targets.length > 0) {
    await db.messageCampaignReceipt.createMany({
      data: input.targets.map((t) => ({
        campaignId: campaign.id,
        studentId: t.studentId,
        courseId: t.courseId ?? null,
        recipientType: t.recipientType,
        to: t.to ?? "",
        templateId: t.templateId,
        bodyvar: t.bodyvar,
        status: t.status,
        errorMessage: t.errorMessage ?? null,
      })),
    });
  }

  return { campaignId: campaign.id, counts };
}
