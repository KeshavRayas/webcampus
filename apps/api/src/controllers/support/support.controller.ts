import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { Request, Response } from "express";
import { SupportService } from "../../services/support/support.service";

type TicketParams = { ticketId: string };

export class SupportController {
  private static getContext(req: Request) {
    if (!req.requestContext) {
      throw new Error("Unauthorized");
    }
    return req.requestContext;
  }

  static async listTickets(req: Request, res: Response) {
    try {
      const context = SupportController.getContext(req);
      const response = await SupportService.listTickets(
        context.userId,
        context.role
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      SupportController.handleError(res, error);
    }
  }

  static async getTicket(req: Request<TicketParams>, res: Response) {
    try {
      const context = SupportController.getContext(req);
      const response = await SupportService.getTicket(
        req.params.ticketId,
        context.userId,
        context.role
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      SupportController.handleError(res, error);
    }
  }

  static async getAttachmentDownloadUrl(
    req: Request<{ attachmentId: string }>,
    res: Response
  ) {
    try {
      const context = SupportController.getContext(req);
      const response = await SupportService.getAttachmentDownloadUrl(
        req.params.attachmentId,
        context.userId,
        context.role
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      SupportController.handleError(res, error);
    }
  }

  static async createTicket(req: Request, res: Response) {
    try {
      const context = SupportController.getContext(req);
      const response = await SupportService.createTicket(
        context.userId,
        req.body,
        (req.files as Express.Multer.File[]) ?? []
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      SupportController.handleError(res, error);
    }
  }

  static async addMessage(req: Request<TicketParams>, res: Response) {
    try {
      const context = SupportController.getContext(req);
      const response = await SupportService.addMessage(
        req.params.ticketId,
        context.userId,
        context.role,
        req.body,
        (req.files as Express.Multer.File[]) ?? []
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 201,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      SupportController.handleError(res, error);
    }
  }

  static async updateStatus(req: Request<TicketParams>, res: Response) {
    try {
      const response = await SupportService.updateStatus(
        req.params.ticketId,
        req.body
      );
      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      SupportController.handleError(res, error);
    }
  }

  static handleError(res: Response, error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to process support request";
    const statusCode = message.includes("not found")
      ? 404
      : message.includes("not allowed") ||
          message.includes("cannot") ||
          message.includes("only")
        ? 403
        : 500;
    logger.error("Support request failed", error);
    sendResponse({ res, status: "error", statusCode, message, error });
  }
}
