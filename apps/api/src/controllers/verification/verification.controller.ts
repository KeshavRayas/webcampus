import { sendResponse } from "@webcampus/backend-utils/helpers";
import {
  VerificationLogsQuerySchema,
  VerificationSettingSchema,
  VerifyHallTicketSchema,
} from "@webcampus/schemas/coe";
import type { Request, Response } from "express";
import { hallTicketVerificationService } from "../../services/shared/hall-ticket-verification.service";

export const verifyHallTicket = async (req: Request, res: Response) => {
  try {
    const params = VerifyHallTicketSchema.parse(req.body);

    const result = await hallTicketVerificationService.verify(params, {
      userId: req.requestContext?.userId,
      role: req.requestContext?.role,
    });

    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Hall ticket verified",
      data: result,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to verify hall ticket",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const listVerificationSettings = async (
  _req: Request,
  res: Response
) => {
  try {
    const data = await hallTicketVerificationService.listSettings();
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Verification settings retrieved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Failed to get verification settings",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const upsertVerificationSetting = async (
  req: Request,
  res: Response
) => {
  try {
    const params = VerificationSettingSchema.parse(req.body);
    const data = await hallTicketVerificationService.upsertSetting({
      ...params,
      updatedById: req.requestContext?.userId,
    });
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Verification setting saved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Failed to save verification setting",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const listVerificationLogs = async (req: Request, res: Response) => {
  try {
    const query = VerificationLogsQuerySchema.parse(req.query);
    const data = await hallTicketVerificationService.listLogs(query);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Verification logs retrieved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to get verification logs",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
