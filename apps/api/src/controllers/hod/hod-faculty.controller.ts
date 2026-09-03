import { auth } from "@webcampus/auth";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import { db, Designation } from "@webcampus/db";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import { resolveHODDepartment } from "../../services/hod/resolve-hod-department";

const monthDiff = (startDate: Date, endDate: Date) => {
  const years = endDate.getFullYear() - startDate.getFullYear();
  const months = endDate.getMonth() - startDate.getMonth();
  return years * 12 + months;
};

const toDurationLabel = (startDate: Date, endDate?: Date | null) => {
  const end = endDate ?? new Date();
  const totalMonths = Math.max(monthDiff(startDate, end), 0);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) {
    return `${months} month${months === 1 ? "" : "s"}`;
  }

  if (months === 0) {
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
};

const getStatusCode = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 401;
  if (error.message.includes("Unauthorized")) return 403;
  if (error.message.includes("not found")) return 404;
  return 500;
};

export const getDepartmentFaculty = async (req: Request, res: Response) => {
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

    const { departmentId } = hodDepartment;

    const { search } = req.query as { search?: string };

    const matchingDesignations = search
      ? (Object.values(Designation) as Designation[]).filter(
          (designation) =>
            designation.toLowerCase().includes(search.toLowerCase()) ||
            designation
              .replace(/_/g, " ")
              .toLowerCase()
              .includes(search.toLowerCase())
        )
      : [];

    const searchConditions = search
      ? [
          {
            user: { name: { contains: search, mode: "insensitive" as const } },
          },
          { employeeId: { contains: search, mode: "insensitive" as const } },
          {
            user: { email: { contains: search, mode: "insensitive" as const } },
          },
          ...(matchingDesignations.length > 0
            ? [{ designation: { in: matchingDesignations } }]
            : []),
        ]
      : undefined;

    const faculties = await db.faculty.findMany({
      where: {
        departmentId,
        ...(searchConditions ? { OR: searchConditions } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const mapped = faculties.map((f) => ({
      id: f.id,
      name: f.user.name,
      employeeId: f.employeeId,
      officialEmail: f.user.email,
      designation: f.designation,
    }));

    sendResponse({
      res,
      status: "success",
      statusCode: 200,
      message: "Department faculty fetched successfully",
      data: mapped,
    });
  } catch (error: unknown) {
    logger.error("Failed to get department faculty", { error });
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

export const getFacultyProfile = async (req: Request, res: Response) => {
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

    const { departmentId } = hodDepartment;

    const { id: facultyId } = req.params;

    const faculty = await db.faculty.findUnique({
      where: { id: facultyId as string },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            username: true,
            displayUsername: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        qualifications: {
          orderBy: {
            yearPassed: "desc",
          },
        },
        publications: {
          orderBy: {
            publishedDate: "desc",
          },
        },
        experiences: {
          orderBy: {
            startDate: "desc",
          },
        },
      },
    });

    if (!faculty || faculty.departmentId !== departmentId) {
      sendResponse({
        res,
        status: "error",
        statusCode: 404,
        message: "Faculty profile not found or access denied",
        error: "Faculty profile not found or access denied",
      });
      return;
    }

    const data = {
      ...faculty,
      experiences: faculty.experiences.map(
        (experience: { startDate: Date; endDate: Date | null }) => ({
          ...experience,
          durationLabel: toDurationLabel(
            experience.startDate,
            experience.endDate
          ),
        })
      ),
    };

    sendResponse({
      res,
      status: "success",
      statusCode: 200,
      message: "Faculty profile fetched successfully",
      data,
    });
  } catch (error: unknown) {
    logger.error("Error retrieving faculty profile by HOD", { error });
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
