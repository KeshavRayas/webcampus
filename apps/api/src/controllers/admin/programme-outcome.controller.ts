import { db } from "@webcampus/db";
import {
  CreateProgrammeOutcomeSchema,
  UpdateProgrammeOutcomeSchema,
} from "@webcampus/schemas/admin";
import { NextFunction, Request, Response } from "express";

export const getProgrammeOutcomes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const outcomes = await db.programmeOutcome.findMany({
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { programType: "asc" },
        { departmentId: "asc" },
        { type: "asc" },
        { code: "asc" },
      ],
    });

    res.status(200).json({ success: true, data: outcomes });
  } catch (error) {
    next(error);
  }
};

export const createProgrammeOutcome = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Normalize legacy/empty-string payloads ("None" option sends "") to null
    // before validation so common (department-less) outcomes can be created.
    const normalizedBody = {
      ...req.body,
      departmentId:
        req.body?.departmentId === "" ? null : req.body?.departmentId,
    };
    const parsed = CreateProgrammeOutcomeSchema.parse(normalizedBody);

    // I will use findFirst to be safe with null departmentId.
    const duplicate = await db.programmeOutcome.findFirst({
      where: {
        programType: parsed.programType,
        departmentId: parsed.departmentId || null,
        type: parsed.type,
        code: parsed.code,
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message:
          "An outcome with this code already exists for the specified programme and type.",
      });
    }

    const outcome = await db.programmeOutcome.create({
      data: {
        ...parsed,
        departmentId: parsed.departmentId || null,
      },
    });

    res.status(201).json({ success: true, data: outcome });
  } catch (error) {
    next(error);
  }
};

export const updateProgrammeOutcome = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const parsed = UpdateProgrammeOutcomeSchema.parse(req.body);

    const existing = await db.programmeOutcome.findUnique({
      where: { id: id as string },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Outcome not found" });
    }

    if (
      parsed.code ||
      parsed.programType ||
      parsed.type ||
      parsed.departmentId !== undefined
    ) {
      const pProgramType = parsed.programType ?? existing.programType;
      const pDepartmentId =
        parsed.departmentId !== undefined
          ? parsed.departmentId
          : existing.departmentId;
      const pType = parsed.type ?? existing.type;
      const pCode = parsed.code ?? existing.code;

      const duplicate = await db.programmeOutcome.findFirst({
        where: {
          programType: pProgramType,
          departmentId: pDepartmentId || null,
          type: pType,
          code: pCode,
          id: { not: id as string },
        },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message:
            "Another outcome with this code already exists for the specified programme and type.",
        });
      }
    }

    const updated = await db.programmeOutcome.update({
      where: { id: id as string },
      data: {
        ...parsed,
        departmentId: parsed.departmentId === "" ? null : parsed.departmentId,
      },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteProgrammeOutcome = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const existing = await db.programmeOutcome.findUnique({
      where: { id: id as string },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Outcome not found" });
    }

    await db.programmeOutcome.delete({
      where: { id: id as string },
    });

    res
      .status(200)
      .json({ success: true, message: "Outcome deleted successfully" });
  } catch (error) {
    next(error);
  }
};
