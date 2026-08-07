import { db } from "@webcampus/db";
import type { MessageCategory, SendConfigType } from "@webcampus/schemas/admin";
import { persistCampaign, type CampaignTarget } from "./campaign.service";
import { resolveTargets, type RecipientTarget } from "./recipients.service";
import { getFieldSourcesForCategory } from "./template-config";
import { getMessageChannel, type MessageChannel } from "./whatsapp.channel";

const CHUNK_SIZE = 500;

export const whatsappService = {
  getFieldSources(category: MessageCategory) {
    return getFieldSourcesForCategory(category);
  },

  async listCourses(params: {
    semesterId?: string;
    departmentId?: string;
  }): Promise<{ id: string; code: string; name: string }[]> {
    const courses = await db.course.findMany({
      where: {
        ...(params.semesterId ? { semesterId: params.semesterId } : {}),
        ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
    return courses;
  },

  async preview(config: SendConfigType) {
    const resolved = await resolveTargets(config);
    const sendable = resolved.targets.filter((t) => t.to);
    const skippedCount = resolved.targets.length - sendable.length;
    return {
      category: resolved.category,
      scope: resolved.scope,
      studentTemplate: resolved.studentTemplate,
      parentTemplate: resolved.parentTemplate,
      recipients: sendable,
      totalCount: sendable.length,
      skippedCount,
    };
  },

  async send(config: SendConfigType, sentById: string) {
    const resolved = await resolveTargets(config);
    const channel: MessageChannel = getMessageChannel("WHATSAPP");

    const sendable = resolved.targets.filter(
      (t): t is RecipientTarget & { to: string } => Boolean(t.to)
    );
    const skipped = resolved.targets.filter((t) => !t.to);

    const campaignTargets: CampaignTarget[] = [];

    const byTemplate = new Map<string, typeof sendable>();
    for (const target of sendable) {
      const list = byTemplate.get(target.templateId) ?? [];
      list.push(target);
      byTemplate.set(target.templateId, list);
    }

    const allProviderResponses: unknown[] = [];

    for (const [templateId, receivers] of byTemplate) {
      for (let i = 0; i < receivers.length; i += CHUNK_SIZE) {
        const chunk = receivers.slice(i, i + CHUNK_SIZE);
        let result: { ok: boolean; raw: unknown };
        try {
          result = await channel.send({
            templateId,
            receivers: chunk.map((r) => ({ to: r.to, bodyvar: r.bodyvar })),
          });
        } catch (err) {
          result = {
            ok: false,
            raw: { error: err instanceof Error ? err.message : String(err) },
          };
        }
        allProviderResponses.push(result.raw);
        for (const target of chunk) {
          campaignTargets.push({
            ...target,
            status: result.ok ? "SUCCESS" : "FAILURE",
            ...(result.ok ? {} : { errorMessage: extractError(result.raw) }),
          });
        }
      }
    }

    for (const target of skipped) {
      campaignTargets.push({
        ...target,
        status: "SKIPPED",
        errorMessage: target.skipReason ?? "Skipped",
      });
    }

    return persistCampaign({
      config,
      category: resolved.category,
      scope: resolved.scope,
      studentTemplateId: resolved.studentTemplate?.id,
      parentTemplateId: resolved.parentTemplate?.id,
      sentById,
      targets: campaignTargets,
      providerResponse: allProviderResponses,
    });
  },
};

function extractError(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 300);
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const candidate =
      record.message ?? record.error ?? record.statusText ?? record.status;
    if (typeof candidate === "string") return candidate.slice(0, 300);
  }
  try {
    return JSON.stringify(raw).slice(0, 500);
  } catch {
    return "Unknown send error";
  }
}
