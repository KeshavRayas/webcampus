import { sendResponse } from "@webcampus/backend-utils/helpers";
import {
  HallTicketFilterSchema,
  SendHallTicketParamsSchema,
  UnsendHallTicketParamsSchema,
} from "@webcampus/schemas/coe";
import type { Request, Response } from "express";
import { hallTicketService } from "../../services/shared/hall-ticket.service";

export const listEligibleStudents = async (req: Request, res: Response) => {
  try {
    const filters = HallTicketFilterSchema.parse(req.query);
    const data = await hallTicketService.list(filters);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Eligible students retrieved",
      data,
    });
  } catch (err) {
    console.error("HALL TICKET LIST ERROR:", err);
    if (err instanceof Error) {
      console.error(err.stack);
    }
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to list eligible students",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const getStudentHallTicketData = async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId as string;
    const academicTermId = req.params.academicTermId as string;
    const data = await hallTicketService.getData(studentId, academicTermId);
    if (!data) {
      sendResponse({
        res,
        statusCode: 404,
        status: "error",
        message: "Hall ticket data not found",
        error: "Not found",
      });
      return;
    }
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Hall ticket data retrieved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to get hall ticket data",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const downloadStudentHallTicketPdf = async (
  req: Request,
  res: Response
) => {
  try {
    const studentId = req.params.studentId as string;
    const academicTermId = req.params.academicTermId as string;
    const pdf = await hallTicketService.generatePdfBuffer(
      studentId,
      academicTermId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hall-ticket-${studentId}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to download hall ticket",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const unsendHallTickets = async (req: Request, res: Response) => {
  try {
    const params = UnsendHallTicketParamsSchema.parse(req.body);
    const result = await hallTicketService.unsend(params);
    if (result.updated === 0) {
      sendResponse({
        res,
        statusCode: 200,
        status: "success",
        message: "No sent hall tickets to unsend.",
        data: result,
      });
      return;
    }
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Hall tickets unsent successfully",
      data: result,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to unsend hall tickets",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const sendHallTickets = async (req: Request, res: Response) => {
  try {
    const params = SendHallTicketParamsSchema.parse(req.body);
    const sentBy = req.requestContext?.userId ?? "unknown";
    await hallTicketService.send(params, sentBy);
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Hall tickets sent successfully",
      data: null,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to send hall tickets",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const getAcademicTerms = async (_req: Request, res: Response) => {
  try {
    const data = await hallTicketService.getAcademicTerms();
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Academic terms retrieved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to get academic terms",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const getDepartments = async (_req: Request, res: Response) => {
  try {
    const data = await hallTicketService.getDepartments();
    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Departments retrieved",
      data,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to get departments",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
