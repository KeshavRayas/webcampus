import { db, Prisma } from "@webcampus/db";
import type { UpdateCourseOutcomesType } from "@webcampus/schemas/faculty";
import type { Request, Response } from "express";

export const getCourseOutcomes = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.query;

    if (!courseId || typeof courseId !== "string") {
      return res.status(400).json({
        status: "error",
        message: "courseId is required",
      });
    }

    const outcomes = await db.courseOutcome.findMany({
      where: {
        courseId,
      },
      orderBy: {
        code: "asc",
      },
    });

    return res.status(200).json({
      status: "success",
      data: outcomes,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const updateCourseOutcomes = async (req: Request, res: Response) => {
  try {
    const { courseId, outcomes } = req.body as UpdateCourseOutcomesType;

    if (!courseId) {
      return res.status(400).json({
        status: "error",
        message: "courseId is required",
      });
    }

    // A check here to ensure the user is a coordinator for the course could be added
    // if required by existing patterns (e.g., check CourseCoordinator).

    // Using a transaction to delete removed outcomes and upsert existing/new ones
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const incomingIds = outcomes.map((o) => o.id).filter(Boolean) as string[];

      // Delete outcomes that are not in the new list
      await tx.courseOutcome.deleteMany({
        where: {
          courseId,
          id: {
            notIn: incomingIds,
          },
        },
      });

      for (const outcome of outcomes) {
        if (outcome.id) {
          await tx.courseOutcome.update({
            where: { id: outcome.id },
            data: {
              code: outcome.code,
              description: outcome.description,
              isActive: outcome.isActive,
            },
          });
        } else {
          await tx.courseOutcome.create({
            data: {
              courseId,
              code: outcome.code,
              description: outcome.description,
              isActive: outcome.isActive,
            },
          });
        }
      }
    });

    return res.status(200).json({
      status: "success",
      message: "Course outcomes updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
