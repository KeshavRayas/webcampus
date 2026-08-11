import { sendResponse } from "@webcampus/backend-utils/helpers";
import { db } from "@webcampus/db";
import {
  CampaignListQuerySchema,
  CampaignReceiptQuerySchema,
  CreateMessageTemplateSchema,
  MessageCategorySchema,
  MessageTemplateQuerySchema,
  SendConfigSchema,
  UpdateMessageTemplateSchema,
} from "@webcampus/schemas/admin";
import type { Request, Response } from "express";
import { whatsappService } from "../../services/admin/whatsapp/whatsapp.service";

const getId = (req: Request): string => req.params.id as string;

export const listTemplates = async (req: Request, res: Response) => {
  try {
    const query = MessageTemplateQuerySchema.parse(req.query);
    const templates = await db.messageTemplate.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.recipientType ? { recipientType: query.recipientType } : {}),
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      include: { variables: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Message templates retrieved",
      data: templates,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to list templates",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const data = CreateMessageTemplateSchema.parse(req.body);
    const createdById = req.requestContext?.userId ?? "unknown";
    const template = await db.messageTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        recipientType: data.recipientType,
        externalTemplateId: data.externalTemplateId,
        smsTemplateId: data.smsTemplateId ?? null,
        messageBody: data.messageBody,
        isActive: data.isActive,
        createdById,
        variables: {
          create: data.variables.map((v) => ({
            position: v.position,
            label: v.label,
            fieldSource: v.fieldSource,
          })),
        },
      },
      include: { variables: { orderBy: { position: "asc" } } },
    });
    sendResponse({
      res,
      statusCode: 201,
      status: "success",
      message: "Message template created",
      data: template,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to create template",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    const data = UpdateMessageTemplateSchema.parse(req.body);
    const template = await db.$transaction(async (tx) => {
      if (data.variables) {
        await tx.messageTemplateVariable.deleteMany({
          where: { templateId: id },
        });
      }
      return tx.messageTemplate.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.category ? { category: data.category } : {}),
          ...(data.recipientType ? { recipientType: data.recipientType } : {}),
          ...(data.externalTemplateId
            ? { externalTemplateId: data.externalTemplateId }
            : {}),
          ...(data.smsTemplateId !== undefined
            ? { smsTemplateId: data.smsTemplateId }
            : {}),
          ...(data.messageBody ? { messageBody: data.messageBody } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.variables
            ? {
                variables: {
                  create: data.variables.map((v) => ({
                    position: v.position,
                    label: v.label,
                    fieldSource: v.fieldSource,
                  })),
                },
              }
            : {}),
        },
        include: { variables: { orderBy: { position: "asc" } } },
      });
    });
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Message template updated",
      data: template,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to update template",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    await db.messageTemplate.delete({ where: { id } });
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Message template deleted",
      data: null,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to delete template",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const getTemplateFields = async (req: Request, res: Response) => {
  try {
    const category = MessageCategorySchema.parse(req.query.category);
    const data = whatsappService.getFieldSources(category);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Field sources retrieved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to get field sources",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const listCourses = async (req: Request, res: Response) => {
  try {
    const data = await whatsappService.listCourses({
      semesterId: req.query.semesterId as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
    });
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Courses retrieved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to get courses",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const previewMessage = async (req: Request, res: Response) => {
  try {
    const config = SendConfigSchema.parse(req.body);
    const data = await whatsappService.preview(config);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Preview generated",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to generate preview",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const config = SendConfigSchema.parse(req.body);
    const sentById = req.requestContext?.userId ?? "unknown";
    const data = await whatsappService.send(config, sentById);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Messages sent",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to send messages",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const listCampaigns = async (req: Request, res: Response) => {
  try {
    const { page, limit } = CampaignListQuerySchema.parse(req.query);
    const total = await db.messageCampaign.count();
    const campaigns = await db.messageCampaign.findMany({
      include: {
        studentTemplate: { select: { name: true } },
        parentTemplate: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const totalPages = Math.ceil(total / limit);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Campaigns retrieved",
      data: {
        items: campaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to list campaigns",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const getCampaign = async (req: Request, res: Response) => {
  try {
    const id = getId(req);
    const { page, limit, status } = CampaignReceiptQuerySchema.parse(req.query);
    const campaign = await db.messageCampaign.findUnique({
      where: { id },
      include: {
        studentTemplate: { select: { name: true } },
        parentTemplate: { select: { name: true } },
      },
    });
    if (!campaign) {
      sendResponse({
        res,
        statusCode: 404,
        status: "error",
        message: "Campaign not found",
        error: "Not found",
      });
      return;
    }
    const where = {
      campaignId: id,
      ...(status ? { status } : {}),
    };
    const [receipts, total] = await Promise.all([
      db.messageCampaignReceipt.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.messageCampaignReceipt.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Campaign retrieved",
      data: {
        campaign,
        receipts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to get campaign",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
