import { auth } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";

export const getDepartmentCourses = async (req: Request, res: Response) => {
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

    const { semesterId, cycle, sectionId } = req.query as Record<
      string,
      string
    >;

    const department = await db.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    // Base query for courses
    const whereClause: {
      departmentId: string;
      semesterId?: string;
      cycle?: Cycle;
      sections?: { some: { id: string } };
    } = { departmentId };

    if (semesterId) {
      whereClause.semesterId = semesterId;
    }

    if (cycle && department.type === "BASIC_SCIENCES") {
      whereClause.cycle = cycle as Cycle;
    }

    // If sectionId is provided, we only want courses mapped to this section
    if (sectionId) {
      whereClause.sections = { some: { id: sectionId } };
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

    res.json({
      status: "success",
      message: "Department courses fetched successfully",
      data: mapped,
    });
  } catch (error: unknown) {
    logger.error("Failed to get department courses", { error });
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getDepartmentSections = async (req: Request, res: Response) => {
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

    const { semesterId, cycle, courseId } = req.query as Record<string, string>;

    const department = await db.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    const whereClause: {
      departmentId: string;
      semesterId?: string;
      cycle?: Cycle;
      courses?: { some: { id: string } };
    } = { departmentId };

    if (semesterId) {
      whereClause.semesterId = semesterId;
    }

    if (cycle && department.type === "BASIC_SCIENCES") {
      whereClause.cycle = cycle as Cycle;
    }

    if (courseId) {
      whereClause.courses = { some: { id: courseId } };
    }

    const sections = await db.section.findMany({
      where: whereClause,
      select: { id: true, name: true },
    });

    res.json({
      status: "success",
      message: "Department sections fetched successfully",
      data: sections,
    });
  } catch (error: unknown) {
    logger.error("Failed to get department sections", { error });
    res.status(500).json({ error: (error as Error).message });
  }
};
