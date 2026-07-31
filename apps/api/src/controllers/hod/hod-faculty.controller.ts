import { auth } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";

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

export const getDepartmentFaculty = async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const facultyUser = await db.faculty.findUnique({
      where: { userId: session.user.id },
    });

    const departmentId = facultyUser?.departmentId;
    if (!departmentId) {
      return res
        .status(403)
        .json({ error: "Unauthorized: No department attached to HOD" });
    }

    const faculties = await db.faculty.findMany({
      where: { departmentId },
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

    res.json({
      status: "success",
      message: "Department faculty fetched successfully",
      data: mapped,
    });
  } catch (error: unknown) {
    logger.error("Failed to get department faculty", { error });
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getFacultyProfile = async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const facultyUser = await db.faculty.findUnique({
      where: { userId: session.user.id },
    });

    const departmentId = facultyUser?.departmentId;
    if (!departmentId) {
      return res
        .status(403)
        .json({ error: "Unauthorized: No department attached to HOD" });
    }

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
      return res
        .status(404)
        .json({ error: "Faculty profile not found or access denied" });
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

    res.json({
      status: "success",
      message: "Faculty profile fetched successfully",
      data,
    });
  } catch (error: unknown) {
    logger.error("Error retrieving faculty profile by HOD", { error });
    res.status(500).json({ error: (error as Error).message });
  }
};
