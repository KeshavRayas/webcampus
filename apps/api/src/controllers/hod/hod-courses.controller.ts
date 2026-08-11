import { auth } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import { resolveHODDepartment } from "../../services/hod/resolve-hod-department";

export const getDepartmentCourses = async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const hodDepartment = await resolveHODDepartment(session.user.id);
    if (!hodDepartment) {
      return res
        .status(403)
        .json({ error: "Unauthorized: No department attached to HOD" });
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

    const hodDepartment = await resolveHODDepartment(session.user.id);
    if (!hodDepartment) {
      return res
        .status(403)
        .json({ error: "Unauthorized: No department attached to HOD" });
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
