import { db } from "@webcampus/db";
import { NextFunction, Request, Response } from "express";

export const getProgrammeOutcomesForCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.query;
    if (!courseId || typeof courseId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Course ID is required" });
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        semester: true,
      },
    });

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const programType = course.semester?.programType;
    if (!programType) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Could not determine program type for this course",
        });
    }

    // Outcomes are either common to the programType (departmentId = null)
    // or specific to the programType and departmentId of the course.
    const outcomes = await db.programmeOutcome.findMany({
      where: {
        programType: programType,
        isActive: true,
        OR: [{ departmentId: null }, { departmentId: course.departmentId }],
      },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    });

    res.status(200).json({ success: true, data: outcomes });
  } catch (error) {
    next(error);
  }
};
