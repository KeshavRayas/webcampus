import { logger } from "@webcampus/common/logger";
import { AcademicTerm, db, Department, Semester } from "@webcampus/db";
import {
  CreateBonusAttendanceWindowType,
  GetBonusAttendanceWindowsQueryType,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

type BonusAttendanceWindowWithRelations = {
  id: string;
  academicTermId: string;
  semesterId: string;
  departmentId: string | null;
  cycle: "PHYSICS" | "CHEMISTRY" | "NONE" | null;
  days: number;
  isOpen: boolean;
  academicTerm: Pick<AcademicTerm, "type" | "year">;
  semester: Pick<Semester, "semesterNumber" | "programType">;
  department: Pick<Department, "id" | "code" | "name"> | null;
};

export interface BonusAttendanceWindowListItem {
  id: string;
  academicTermId: string;
  semesterId: string;
  semesterNumber: number;
  semesterProgramType: "UG" | "PG";
  academicTermLabel: string;
  departmentId: string | null;
  departmentName: string | null;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
  days: number;
  isOpen: boolean;
  instanceName: string;
}

export class BonusAttendanceWindowService {
  private static getWindowScopeLabel(
    window: BonusAttendanceWindowWithRelations
  ): string {
    if (window.department) {
      return window.department.code;
    }

    if (window.cycle) {
      return window.cycle;
    }

    return "All";
  }

  private static mapWindowToListItem(
    window: BonusAttendanceWindowWithRelations
  ): BonusAttendanceWindowListItem {
    const termType =
      window.academicTerm.type.charAt(0).toUpperCase() +
      window.academicTerm.type.slice(1);
    const academicTermLabel = `${termType} ${window.academicTerm.year}`;

    return {
      id: window.id,
      academicTermId: window.academicTermId,
      semesterId: window.semesterId,
      semesterNumber: window.semester.semesterNumber,
      semesterProgramType: window.semester.programType,
      academicTermLabel,
      departmentId: window.departmentId,
      departmentName: window.department?.name ?? null,
      cycle:
        window.cycle === "PHYSICS" || window.cycle === "CHEMISTRY"
          ? window.cycle
          : null,
      days: window.days,
      isOpen: window.isOpen,
      instanceName: `${academicTermLabel} - Sem ${window.semester.semesterNumber} - ${BonusAttendanceWindowService.getWindowScopeLabel(window)}`,
    };
  }

  private static async validateCreateInput(
    input: CreateBonusAttendanceWindowType
  ): Promise<void> {
    const semester = await db.semester.findUnique({
      where: { id: input.semesterId },
      select: {
        id: true,
        academicTermId: true,
        semesterNumber: true,
        programType: true,
      },
    });

    if (!semester) {
      throw new Error("Semester not found");
    }

    if (semester.academicTermId !== input.academicTermId) {
      throw new Error("Semester does not belong to the selected academic term");
    }

    const isFirstYearUGInstance =
      semester.programType === "UG" &&
      FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber);

    if (isFirstYearUGInstance && input.departmentId) {
      throw new Error(
        "Department cannot be set for UG first-year bonus attendance windows"
      );
    }

    if (!isFirstYearUGInstance && input.cycle) {
      throw new Error(
        "Cycle can only be set for UG first-year bonus attendance windows"
      );
    }

    if (input.departmentId) {
      const department = await db.department.findUnique({
        where: { id: input.departmentId },
        select: { id: true },
      });

      if (!department) {
        throw new Error("Department not found");
      }
    }
  }

  static async getWindows(
    query: GetBonusAttendanceWindowsQueryType
  ): Promise<BaseResponse<BonusAttendanceWindowListItem[]>> {
    try {
      const windows = await db.bonusAttendanceWindow.findMany({
        where: {
          academicTermId: query.academicTermId,
          semesterId: query.semesterId,
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          ...(query.cycle ? { cycle: query.cycle } : {}),
        },
        include: {
          academicTerm: {
            select: {
              type: true,
              year: true,
            },
          },
          semester: {
            select: {
              semesterNumber: true,
              programType: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [
          { isOpen: "desc" },
          { departmentId: "asc" },
          { cycle: "asc" },
        ],
      });

      return {
        status: "success",
        message: "Bonus attendance windows fetched successfully",
        data: windows.map((window) => this.mapWindowToListItem(window)),
      };
    } catch (error) {
      logger.error("Failed to fetch bonus attendance windows", error);
      throw new Error("Failed to fetch bonus attendance windows");
    }
  }

  static async createWindow(
    input: CreateBonusAttendanceWindowType
  ): Promise<BaseResponse<BonusAttendanceWindowListItem>> {
    try {
      await this.validateCreateInput(input);

      const existing = await db.bonusAttendanceWindow.findFirst({
        where: {
          academicTermId: input.academicTermId,
          semesterId: input.semesterId,
          departmentId: input.departmentId ?? null,
          cycle: input.cycle ?? null,
        },
        include: {
          academicTerm: { select: { type: true, year: true } },
          semester: { select: { semesterNumber: true, programType: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      });

      if (existing) {
        return {
          status: "success",
          message: "Bonus attendance window already exists",
          data: this.mapWindowToListItem(existing),
        };
      }

      const created = await db.bonusAttendanceWindow.create({
        data: {
          academicTermId: input.academicTermId,
          semesterId: input.semesterId,
          departmentId: input.departmentId ?? null,
          cycle: input.cycle ?? null,
          days: input.days,
        },
        include: {
          academicTerm: { select: { type: true, year: true } },
          semester: { select: { semesterNumber: true, programType: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      });

      return {
        status: "success",
        message: "Bonus attendance window created successfully",
        data: this.mapWindowToListItem(created),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      logger.error("Failed to create bonus attendance window", error);
      throw new Error("Failed to create bonus attendance window");
    }
  }

  static async toggleWindow(
    id: string,
    isOpen: boolean
  ): Promise<BaseResponse<BonusAttendanceWindowListItem>> {
    try {
      const updated = await db.bonusAttendanceWindow.update({
        where: { id },
        data: { isOpen },
        include: {
          academicTerm: { select: { type: true, year: true } },
          semester: { select: { semesterNumber: true, programType: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      });

      return {
        status: "success",
        message: `Bonus attendance window ${isOpen ? "opened" : "closed"} successfully`,
        data: this.mapWindowToListItem(updated),
      };
    } catch (error) {
      logger.error("Failed to toggle bonus attendance window", error);
      throw new Error("Failed to toggle bonus attendance window");
    }
  }

  static async updateWindow(
    id: string,
    days: number
  ): Promise<BaseResponse<BonusAttendanceWindowListItem>> {
    try {
      const existing = await db.bonusAttendanceWindow.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("Bonus attendance window not found");
      }

      const updated = await db.bonusAttendanceWindow.update({
        where: { id },
        data: { days },
        include: {
          academicTerm: { select: { type: true, year: true } },
          semester: { select: { semesterNumber: true, programType: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      });

      return {
        status: "success",
        message: "Bonus attendance window updated successfully",
        data: this.mapWindowToListItem(updated),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      logger.error("Failed to update bonus attendance window", error);
      throw new Error("Failed to update bonus attendance window");
    }
  }
}
