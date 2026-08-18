import { sendResponse } from "@webcampus/backend-utils/helpers";
import { db } from "@webcampus/db";
import type { Request, Response } from "express";

export const getSections = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const cycle = req.query.cycle as string | undefined;

    if (!semesterId) {
      sendResponse({
        res,
        statusCode: 400,
        status: "error",
        message: "semesterId is required",
        error: "Validation error",
      });
      return;
    }

    const where: Record<string, unknown> = { semesterId };
    if (departmentId) where.departmentId = departmentId;
    if (cycle) where.cycle = cycle;

    const sections = await db.section.findMany({
      where,
      select: {
        id: true,
        name: true,
        departmentId: true,
        semesterId: true,
        cycle: true,
      },
      orderBy: { name: "asc" },
    });

    sendResponse({
      res,
      statusCode: 200,
      status: "success",
      message: "Sections retrieved",
      data: sections,
    });
  } catch (err) {
    sendResponse({
      res,
      statusCode: 500,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to get sections",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
