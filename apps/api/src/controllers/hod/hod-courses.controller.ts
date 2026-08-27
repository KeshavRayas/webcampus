import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import { resolveHODDepartment } from "../../services/hod/resolve-hod-department";

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 401;
  if (error.message.includes("Unauthorized")) return 403;
  return 500;
};

export const getDepartmentCourses = async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) {
      sendResponse({
        res,
        status: "error",
        statusCode: 401,
        message: ERRORS.UNAUTHORIZED,
        error: ERRORS.UNAUTHORIZED,
      });
      return;
    }

    const hodDepartment = await resolveHODDepartment(session.user.id);
    if (!hodDepartment) {
      sendResponse({
        res,
        status: "error",
        statusCode: 403,
        message: "Unauthorized: No department attached to HOD",
        error: "Unauthorized: No department attached to HOD",
      });
      return;
    }

    const { departmentId, departmentType } = hodDepartment;

    const { semesterId, cycle, sectionId, academicTermId } = req.query as {
      semesterId?: string;
      cycle?: string;
      sectionId?: string;
      academicTermId?: string;
    };

    const whereClause: {
      departmentId: string;
      semesterId?: string;
      semester?: { academicTermId: string };
      cycle?: Cycle;
      assignments?: { some: { sectionId: string } };
    } = { departmentId };

    if (academicTermId) {
      whereClause.semester = { academicTermId };
    }

    if (semesterId) {
      whereClause.semesterId = semesterId;
    }

    if (cycle && departmentType === "BASIC_SCIENCES") {
      whereClause.cycle = cycle as Cycle;
    }

    if (sectionId) {
      whereClause.assignments = { some: { sectionId } };
    }

    const courses = await db.course.findMany({
      where: whereClause,
      include: {
        semester: { select: { semesterNumber: true, programType: true } },
      },
    });

    const mapped = courses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      semester: c.semester?.semesterNumber,
      cycle: c.cycle,
      courseType: c.courseType,
      credits: c.lectureCredits + c.tutorialCredits + c.practicalCredits,
    }));

    sendResponse({
      res,
      status: "success",
      statusCode: 200,
      message: "Department courses fetched successfully",
      data: mapped,
    });
  } catch (error: unknown) {
    logger.error("Failed to get department courses", { error });
    sendResponse({
      res,
      status: "error",
      statusCode: getStatusCode(error),
      message:
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
};

export const getDepartmentSections = async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) {
      sendResponse({
        res,
        status: "error",
        statusCode: 401,
        message: ERRORS.UNAUTHORIZED,
        error: ERRORS.UNAUTHORIZED,
      });
      return;
    }

    const hodDepartment = await resolveHODDepartment(session.user.id);
    if (!hodDepartment) {
      sendResponse({
        res,
        status: "error",
        statusCode: 403,
        message: "Unauthorized: No department attached to HOD",
        error: "Unauthorized: No department attached to HOD",
      });
      return;
    }

    const { departmentId, departmentType } = hodDepartment;

    const { semesterId, cycle, courseId } = req.query as Record<string, string>;

    const whereClause: {
      departmentId: string;
      semesterId?: string;
      cycle?: Cycle;
      courses?: { some: { courseId: string } };
    } = { departmentId };

    if (semesterId) {
      whereClause.semesterId = semesterId;
    }

    if (cycle && departmentType === "BASIC_SCIENCES") {
      whereClause.cycle = cycle as Cycle;
    }

    if (courseId) {
      whereClause.courses = { some: { courseId } };
    }

    const sections = await db.section.findMany({
      where: whereClause,
      select: { id: true, name: true },
    });

    sendResponse({
      res,
      status: "success",
      statusCode: 200,
      message: "Department sections fetched successfully",
      data: sections,
    });
  } catch (error: unknown) {
    logger.error("Failed to get department sections", { error });
    sendResponse({
      res,
      status: "error",
      statusCode: getStatusCode(error),
      message:
        error instanceof Error ? error.message : ERRORS.INTERNAL_SERVER_ERROR,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
};
