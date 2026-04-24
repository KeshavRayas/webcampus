import { logger } from "@webcampus/common/logger";
import { AcademicTerm, db, Department, Semester } from "@webcampus/db";
import {
  CreateRegistrationWindowType,
  GetRegistrationWindowsQueryType,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

type RegistrationWindowWithRelations = {
  id: string;
  academicTermId: string;
  semesterId: string;
  departmentId: string | null;
  cycle: "PHYSICS" | "CHEMISTRY" | "NONE" | null;
  isOpen: boolean;
  academicTerm: Pick<AcademicTerm, "type" | "year">;
  semester: Pick<Semester, "semesterNumber" | "programType">;
  department: Pick<Department, "id" | "code" | "name"> | null;
};

export interface RegistrationWindowListItem {
  id: string;
  academicTermId: string;
  semesterId: string;
  semesterNumber: number;
  semesterProgramType: "UG" | "PG";
  academicTermLabel: string;
  departmentId: string | null;
  departmentName: string | null;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
  isOpen: boolean;
  instanceName: string;
}

export interface RegistrationWindowCourseItem {
  id: string;
  code: string;
  name: string;
  courseType: string;
  ltp: string;
  totalCredits: number;
}

export class RegistrationWindowService {
  private static getWindowScopeLabel(
    window: RegistrationWindowWithRelations
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
    window: RegistrationWindowWithRelations
  ): RegistrationWindowListItem {
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
      isOpen: window.isOpen,
      instanceName: `${academicTermLabel} - Sem ${window.semester.semesterNumber} - ${RegistrationWindowService.getWindowScopeLabel(window)}`,
    };
  }

  private static async validateCreateInput(
    input: CreateRegistrationWindowType
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
        "Department cannot be set for UG first-year registration windows"
      );
    }

    if (!isFirstYearUGInstance && input.cycle) {
      throw new Error(
        "Cycle can only be set for UG first-year registration windows"
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
    query: GetRegistrationWindowsQueryType
  ): Promise<BaseResponse<RegistrationWindowListItem[]>> {
    try {
      const windows = await db.registrationWindow.findMany({
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
        message: "Registration windows fetched successfully",
        data: windows.map((window) => this.mapWindowToListItem(window)),
      };
    } catch (error) {
      logger.error("Failed to fetch registration windows", error);
      throw new Error("Failed to fetch registration windows");
    }
  }

  static async createWindow(
    input: CreateRegistrationWindowType
  ): Promise<BaseResponse<RegistrationWindowListItem>> {
    try {
      await this.validateCreateInput(input);

      const existing = await db.registrationWindow.findFirst({
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
          message: "Registration window already exists",
          data: this.mapWindowToListItem(existing),
        };
      }

      const created = await db.registrationWindow.create({
        data: {
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

      return {
        status: "success",
        message: "Registration window created successfully",
        data: this.mapWindowToListItem(created),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      logger.error("Failed to create registration window", error);
      throw new Error("Failed to create registration window");
    }
  }

  static async toggleWindow(
    id: string,
    isOpen: boolean
  ): Promise<BaseResponse<RegistrationWindowListItem>> {
    try {
      const updated = await db.registrationWindow.update({
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
        message: `Registration window ${isOpen ? "opened" : "closed"} successfully`,
        data: this.mapWindowToListItem(updated),
      };
    } catch (error) {
      logger.error("Failed to toggle registration window", error);
      throw new Error("Failed to toggle registration window");
    }
  }

  static async getApprovedCoursesByWindow(
    id: string
  ): Promise<BaseResponse<RegistrationWindowCourseItem[]>> {
    try {
      const window = await db.registrationWindow.findUnique({
        where: { id },
      });

      if (!window) {
        throw new Error("Registration window not found");
      }

      const courses = await db.course.findMany({
        where: {
          semesterId: window.semesterId,
          approvalStatus: "APPROVED",
          ...(window.departmentId ? { departmentId: window.departmentId } : {}),
          ...(window.cycle ? { cycle: window.cycle } : {}),
        },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          courseType: true,
          lectureCredits: true,
          tutorialCredits: true,
          practicalCredits: true,
          skillCredits: true,
          totalCredits: true,
        },
      });

      return {
        status: "success",
        message: "Approved courses fetched successfully",
        data: courses.map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name,
          courseType: course.courseType,
          ltp: `${course.lectureCredits}-${course.tutorialCredits}-${course.practicalCredits}-${course.skillCredits}`,
          totalCredits: course.totalCredits,
        })),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      logger.error("Failed to fetch courses for registration window", error);
      throw new Error("Failed to fetch courses for registration window");
    }
  }
}
