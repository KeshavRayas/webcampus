import { sendResponse } from "@webcampus/backend-utils/helpers";
import type { Request, Response } from "express";
import { academicEligibility } from "../../services/shared/academic-eligibility.service";
import { hallTicketService } from "../../services/shared/hall-ticket.service";

export const getMyHallTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.requestContext?.userId;
    if (!userId) {
      sendResponse({
        res,
        statusCode: 401,
        status: "error",
        message: "Unauthorized",
        error: "Unauthorized",
      });
      return;
    }

    const student = await hallTicketService.getStudentForUser(userId);
    if (!student) {
      sendResponse({
        res,
        statusCode: 404,
        status: "error",
        message: "Student profile not found",
        error: "Not found",
      });
      return;
    }

    const academicTerms = await hallTicketService.getAcademicTerms();
    const results: {
      academicTermId: string;
      academicYear: string;
      currentSemester: number;
      isSent: boolean;
      sentAt: string | null;
      allCoursesFrozen: boolean;
      eligible: boolean;
    }[] = [];

    for (const term of academicTerms) {
      const eligibility = await academicEligibility.getCourseEligibility(
        student.id,
        term.id
      );
      if (!eligibility) continue;

      const sendRecord = await hallTicketService.getData(student.id, term.id);

      results.push({
        academicTermId: term.id,
        academicYear: term.label,
        currentSemester: student.currentSemester,
        isSent: sendRecord?.isSent ?? false,
        sentAt: sendRecord?.sentAt ?? null,
        allCoursesFrozen: eligibility.allCoursesFrozen,
        eligible: eligibility.eligible,
      });
    }

    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Hall tickets retrieved",
      data: results,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 400,
      status: "error",
      message:
        err instanceof Error ? err.message : "Failed to get hall tickets",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

export const getMyHallTicketData = async (req: Request, res: Response) => {
  try {
    const userId = req.requestContext?.userId;
    if (!userId) {
      sendResponse({
        res,
        statusCode: 401,
        status: "error",
        message: "Unauthorized",
        error: "Unauthorized",
      });
      return;
    }

    const student = await hallTicketService.getStudentForUser(userId);
    if (!student) {
      sendResponse({
        res,
        statusCode: 404,
        status: "error",
        message: "Student profile not found",
        error: "Not found",
      });
      return;
    }

    const academicTermId = req.params.academicTermId as string;
    const data = await hallTicketService.getData(student.id, academicTermId);

    if (!data) {
      sendResponse({
        res,
        statusCode: 200,
        status: "success",
        message: "Hall ticket data retrieved",
        data: {
          notAvailable: true,
          reason: "No course registrations found for this term",
        },
      });
      return;
    }

    if (!data.allCoursesFrozen) {
      sendResponse({
        res,
        statusCode: 200,
        status: "success",
        message: "Hall ticket data retrieved",
        data: {
          notAvailable: true,
          reason:
            "Courses are not yet fully frozen. Please check back after faculty finalizes marks and attendance.",
        },
      });
      return;
    }

    if (!data.isSent) {
      sendResponse({
        res,
        statusCode: 200,
        status: "success",
        message: "Hall ticket data retrieved",
        data: {
          notAvailable: true,
          reason:
            "Hall ticket has not been sent by the examination office yet.",
        },
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

export const downloadMyHallTicketPdf = async (req: Request, res: Response) => {
  try {
    const userId = req.requestContext?.userId;
    if (!userId) {
      sendResponse({
        res,
        statusCode: 401,
        status: "error",
        message: "Unauthorized",
        error: "Unauthorized",
      });
      return;
    }

    const student = await hallTicketService.getStudentForUser(userId);
    if (!student) {
      sendResponse({
        res,
        statusCode: 404,
        status: "error",
        message: "Student profile not found",
        error: "Not found",
      });
      return;
    }

    const academicTermId = req.params.academicTermId as string;
    const data = await hallTicketService.getData(student.id, academicTermId);

    if (!data) {
      sendResponse({
        res,
        statusCode: 404,
        status: "error",
        message: "Hall ticket not available",
        error: "Not found",
      });
      return;
    }

    if (!data.allCoursesFrozen) {
      sendResponse({
        res,
        statusCode: 400,
        status: "error",
        message: "Hall ticket not ready yet. Courses are not fully frozen.",
        error: "Not ready",
      });
      return;
    }

    if (!data.isSent) {
      sendResponse({
        res,
        statusCode: 400,
        status: "error",
        message: "Hall ticket not yet sent by the examination office.",
        error: "Not sent",
      });
      return;
    }

    const pdf = await hallTicketService.generatePdfBuffer(
      student.id,
      academicTermId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hall-ticket.pdf"`
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
