import { FreezeService } from "@webcampus/api/src/services/faculty/freeze.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type {
  HODAttendanceWindowFilters,
  HODAttendanceWindowRow,
  HODBulkFreeze,
  HODBulkUnfreeze,
  HODSection,
} from "@webcampus/schemas/hod";
import type { BaseResponse } from "@webcampus/types/api";

type ResolvedScope = {
  semesterId: string;
  departmentId: string;
};

export class HODAttendanceWindowService {
  private static async resolveHODDepartment(userId: string): Promise<string> {
    const hod = await db.hod.findUnique({
      where: { userId },
      select: { department: { select: { id: true } } },
    });
    if (!hod?.department) {
      throw new Error("HOD profile not found or department not assigned");
    }
    return hod.department.id;
  }

  private static async resolveScope(
    userId: string,
    input: HODAttendanceWindowFilters
  ): Promise<ResolvedScope> {
    const departmentId = await this.resolveHODDepartment(userId);

    const semester = await db.semester.findUnique({
      where: { id: input.semesterId },
      select: { id: true, academicTermId: true },
    });
    if (!semester) throw new Error("Semester not found");

    const term = await db.academicTerm.findUnique({
      where: { id: input.academicTermId },
      select: { isCurrent: true },
    });
    if (!term) throw new Error("Academic Term not found");
    if (!term.isCurrent) throw new Error("Academic Term is not current");
    if (semester.academicTermId !== input.academicTermId) {
      throw new Error("Semester does not belong to the selected academic term");
    }

    return {
      semesterId: semester.id,
      departmentId,
    };
  }

  private static mapWindowRow(
    row: Awaited<ReturnType<typeof FreezeService.getDepartmentWindows>>[number]
  ): HODAttendanceWindowRow {
    return {
      courseAssignmentId: row.courseAssignmentId,
      courseCode: row.courseCode,
      courseName: row.courseName,
      department: row.department,
      facultyName: row.facultyName,
      semester: row.semester,
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      batchName: row.batchName,
      assignmentType: row.assignmentType as "THEORY" | "LAB",
      freeze: {
        displayState: row.freeze.displayState,
        lockedBy: row.freeze.lockedBy,
        frozenAt: row.freeze.frozenAt,
        message: row.freeze.message,
        frozenByRole: row.freeze.frozenBy.frozenByRole,
        frozenByUsername: row.freeze.frozenBy.frozenByUsername,
        frozenByDisplay: row.freeze.frozenBy.frozenByDisplay,
      },
    };
  }

  static async getWindows(
    userId: string,
    filters: HODAttendanceWindowFilters
  ): Promise<BaseResponse<HODAttendanceWindowRow[]>> {
    try {
      const { semesterId, departmentId } = await this.resolveScope(
        userId,
        filters
      );

      let rows = await FreezeService.getDepartmentWindows(
        departmentId,
        semesterId
      );

      if (filters.sectionId) {
        rows = rows.filter((r) => r.sectionId === filters.sectionId);
      }

      return {
        status: "success",
        message: "Attendance windows fetched successfully",
        data: rows.map((row) => this.mapWindowRow(row)),
      };
    } catch (error) {
      logger.error("Failed to fetch attendance windows", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch attendance windows");
    }
  }

  static async freezeAssignment(
    userId: string,
    courseAssignmentId: string,
    username?: string | null,
    displayUsername?: string | null
  ): Promise<BaseResponse<HODAttendanceWindowRow>> {
    try {
      const freeze = await FreezeService.freeze(
        courseAssignmentId,
        "department",
        username,
        displayUsername
      );

      const assignment = await db.courseAssignment.findUnique({
        where: { id: courseAssignmentId },
        include: {
          course: { select: { code: true, name: true } },
          faculty: { select: { shortName: true } },
          department: { select: { name: true } },
          section: { select: { id: true, name: true } },
          batch: { select: { name: true } },
        },
      });

      if (!assignment) throw new Error("Course assignment not found");

      return {
        status: "success",
        message: "Attendance window closed",
        data: {
          courseAssignmentId: assignment.id,
          courseCode: assignment.course.code,
          courseName: assignment.course.name,
          department: assignment.department.name,
          facultyName: assignment.faculty.shortName,
          semester: assignment.semester,
          sectionId: assignment.section.id,
          sectionName: assignment.section.name,
          batchName: assignment.batch?.name ?? null,
          assignmentType: assignment.assignmentType,
          freeze: {
            displayState: freeze.displayState,
            lockedBy: freeze.lockedBy,
            frozenAt: freeze.frozenAt,
            message: freeze.message,
            frozenByRole: freeze.frozenBy.frozenByRole,
            frozenByUsername: freeze.frozenBy.frozenByUsername,
            frozenByDisplay: freeze.frozenBy.frozenByDisplay,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to close attendance window", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to close attendance window");
    }
  }

  static async unfreezeAssignment(
    userId: string,
    courseAssignmentId: string
  ): Promise<BaseResponse<HODAttendanceWindowRow>> {
    try {
      const freeze = await FreezeService.unfreeze(
        courseAssignmentId,
        "department"
      );

      const assignment = await db.courseAssignment.findUnique({
        where: { id: courseAssignmentId },
        include: {
          course: { select: { code: true, name: true } },
          faculty: { select: { shortName: true } },
          department: { select: { name: true } },
          section: { select: { id: true, name: true } },
          batch: { select: { name: true } },
        },
      });

      if (!assignment) throw new Error("Course assignment not found");

      return {
        status: "success",
        message: "Attendance window reopened",
        data: {
          courseAssignmentId: assignment.id,
          courseCode: assignment.course.code,
          courseName: assignment.course.name,
          department: assignment.department.name,
          facultyName: assignment.faculty.shortName,
          semester: assignment.semester,
          sectionId: assignment.section.id,
          sectionName: assignment.section.name,
          batchName: assignment.batch?.name ?? null,
          assignmentType: assignment.assignmentType,
          freeze: {
            displayState: freeze.displayState,
            lockedBy: freeze.lockedBy,
            frozenAt: freeze.frozenAt,
            message: freeze.message,
            frozenByRole: freeze.frozenBy.frozenByRole,
            frozenByUsername: freeze.frozenBy.frozenByUsername,
            frozenByDisplay: freeze.frozenBy.frozenByDisplay,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to reopen attendance window", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to reopen attendance window");
    }
  }

  static async getSections(
    userId: string,
    semesterId?: string
  ): Promise<HODSection[]> {
    const departmentId = await this.resolveHODDepartment(userId);
    const where: { departmentId: string; semesterId?: string } = {
      departmentId,
    };
    if (semesterId) where.semesterId = semesterId;
    const sections = await db.section.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return sections;
  }

  static async bulkFreeze(
    userId: string,
    payload: HODBulkFreeze,
    username?: string | null,
    displayUsername?: string | null
  ): Promise<
    BaseResponse<{
      processed: number;
      skipped: number;
      failed: number;
      skippedAssignments: string[];
      failedAssignments: string[];
    }>
  > {
    try {
      const { semesterId, departmentId } = await this.resolveScope(
        userId,
        payload
      );

      const assignments = await db.courseAssignment.findMany({
        where: {
          departmentId,
          section: { semesterId },
          ...(payload.sectionId ? { sectionId: payload.sectionId } : {}),
        },
        select: { id: true },
      });

      const result = {
        processed: 0,
        skipped: 0,
        failed: 0,
        skippedAssignments: [] as string[],
        failedAssignments: [] as string[],
      };

      for (const assignment of assignments) {
        try {
          const freeze = await db.freeze.findUnique({
            where: { courseAssignmentId: assignment.id },
          });
          if (freeze?.adminFrozen) {
            result.skipped++;
            result.skippedAssignments.push(assignment.id);
            continue;
          }
          await FreezeService.freeze(
            assignment.id,
            "department",
            username,
            displayUsername
          );
          result.processed++;
        } catch (error) {
          logger.error("Failed to freeze assignment", {
            assignmentId: assignment.id,
            error,
          });
          result.failed++;
          result.failedAssignments.push(assignment.id);
        }
      }

      return {
        status: "success",
        message: `Processed ${result.processed} windows (${result.skipped} skipped, ${result.failed} failed)`,
        data: result,
      };
    } catch (error) {
      logger.error("Failed to freeze attendance windows", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to freeze attendance windows");
    }
  }

  static async bulkUnfreeze(
    userId: string,
    payload: HODBulkUnfreeze
  ): Promise<
    BaseResponse<{
      processed: number;
      skipped: number;
      failed: number;
      skippedAssignments: string[];
      failedAssignments: string[];
    }>
  > {
    try {
      const { semesterId, departmentId } = await this.resolveScope(
        userId,
        payload
      );

      const assignments = await db.courseAssignment.findMany({
        where: {
          departmentId,
          section: { semesterId },
          ...(payload.sectionId ? { sectionId: payload.sectionId } : {}),
        },
        select: { id: true },
      });

      const result = {
        processed: 0,
        skipped: 0,
        failed: 0,
        skippedAssignments: [] as string[],
        failedAssignments: [] as string[],
      };

      for (const assignment of assignments) {
        try {
          const freeze = await db.freeze.findUnique({
            where: { courseAssignmentId: assignment.id },
          });
          if (freeze?.adminFrozen) {
            result.skipped++;
            result.skippedAssignments.push(assignment.id);
            continue;
          }
          await FreezeService.unfreeze(assignment.id, "department");
          result.processed++;
        } catch (error) {
          logger.error("Failed to unfreeze assignment", {
            assignmentId: assignment.id,
            error,
          });
          result.failed++;
          result.failedAssignments.push(assignment.id);
        }
      }

      return {
        status: "success",
        message: `Processed ${result.processed} windows (${result.skipped} skipped, ${result.failed} failed)`,
        data: result,
      };
    } catch (error) {
      logger.error("Failed to unfreeze attendance windows", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to unfreeze attendance windows");
    }
  }
}
