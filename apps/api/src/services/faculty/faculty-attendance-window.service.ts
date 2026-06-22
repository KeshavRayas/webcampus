import { FreezeService } from "@webcampus/api/src/services/faculty/freeze.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type { FacultyBulkFreeze } from "@webcampus/schemas/faculty";
import type { BaseResponse } from "@webcampus/types/api";

type BulkFreezeResult = {
  processed: number;
  skipped: number;
  failed: number;
  skippedAssignments: string[];
  failedAssignments: string[];
};

type WindowsRow = {
  courseAssignmentId: string;
  courseCode: string;
  courseName: string;
  sectionId: string;
  sectionName: string;
  batchName: string | null;
  assignmentType: string;
  freeze: {
    displayState:
      | "OPEN"
      | "FROZEN_BY_FACULTY"
      | "FROZEN_BY_HOD"
      | "LOCKED_BY_ADMIN";
    lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
    frozenBy: {
      frozenByRole: "FACULTY" | "HOD" | "ADMIN" | null;
      frozenByUsername: string | null;
      frozenByDisplay: string | null;
    };
    frozenAt: string | null;
    message: string | null;
  };
};

export class FacultyAttendanceWindowService {
  private static async getFacultyIdByUserId(userId: string): Promise<string> {
    const faculty = await db.faculty.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    return faculty.id;
  }

  private static async validateScope(
    academicTermId: string,
    semesterId: string
  ): Promise<void> {
    const term = await db.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { id: true, isCurrent: true },
    });

    if (!term) {
      throw new Error("Academic Term not found");
    }

    if (!term.isCurrent) {
      throw new Error("Academic Term is not current");
    }

    const semester = await db.semester.findUnique({
      where: { id: semesterId },
      select: { id: true, academicTermId: true },
    });

    if (!semester) {
      throw new Error("Semester not found");
    }

    if (semester.academicTermId !== academicTermId) {
      throw new Error("Semester does not belong to the selected academic term");
    }
  }

  private static mapWindowRow(
    row: Awaited<ReturnType<typeof FreezeService.getFacultyWindows>>[number]
  ): WindowsRow {
    return {
      courseAssignmentId: row.courseAssignmentId,
      courseCode: row.courseCode,
      courseName: row.courseName,
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      batchName: row.batchName,
      assignmentType: row.assignmentType,
      freeze: {
        displayState: row.freeze.displayState,
        lockedBy: row.freeze.lockedBy,
        frozenBy: {
          frozenByRole: row.freeze.frozenBy.frozenByRole,
          frozenByUsername: row.freeze.frozenBy.frozenByUsername,
          frozenByDisplay: row.freeze.frozenBy.frozenByDisplay,
        },
        frozenAt: row.freeze.frozenAt,
        message: row.freeze.message,
      },
    };
  }

  static async getWindows(
    userId: string,
    filters: { academicTermId: string; semesterId: string }
  ): Promise<BaseResponse<WindowsRow[]>> {
    try {
      await FacultyAttendanceWindowService.validateScope(
        filters.academicTermId,
        filters.semesterId
      );

      const facultyId =
        await FacultyAttendanceWindowService.getFacultyIdByUserId(userId);

      const rows = await FreezeService.getFacultyWindows(
        facultyId,
        filters.semesterId
      );

      return {
        status: "success",
        message: "Attendance windows fetched successfully",
        data: rows.map(FacultyAttendanceWindowService.mapWindowRow),
      };
    } catch (error) {
      logger.error("Failed to fetch faculty attendance windows", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to fetch attendance windows");
    }
  }

  static async freezeAssignment(
    userId: string,
    courseAssignmentId: string,
    username?: string | null,
    displayUsername?: string | null
  ): Promise<BaseResponse<WindowsRow>> {
    try {
      const facultyId =
        await FacultyAttendanceWindowService.getFacultyIdByUserId(userId);

      const assignment = await db.courseAssignment.findUnique({
        where: { id: courseAssignmentId },
        select: { facultyId: true },
      });

      if (!assignment) {
        throw new Error("Course assignment not found");
      }

      if (assignment.facultyId !== facultyId) {
        throw new Error("Forbidden: this assignment does not belong to you");
      }

      const freeze = await FreezeService.freeze(
        courseAssignmentId,
        "faculty",
        username,
        displayUsername
      );

      const fullAssignment = await db.courseAssignment.findUnique({
        where: { id: courseAssignmentId },
        include: {
          course: { select: { code: true, name: true } },
          section: { select: { id: true, name: true } },
          batch: { select: { name: true } },
        },
      });

      return {
        status: "success",
        message: "Attendance frozen",
        data: {
          courseAssignmentId,
          courseCode: fullAssignment?.course.code ?? "",
          courseName: fullAssignment?.course.name ?? "",
          sectionId: fullAssignment?.section.id ?? "",
          sectionName: fullAssignment?.section.name ?? "",
          batchName: fullAssignment?.batch?.name ?? null,
          assignmentType: "",
          freeze: {
            displayState: freeze.displayState,
            lockedBy: freeze.lockedBy,
            frozenBy: {
              frozenByRole: freeze.frozenBy.frozenByRole,
              frozenByUsername: freeze.frozenBy.frozenByUsername,
              frozenByDisplay: freeze.frozenBy.frozenByDisplay,
            },
            frozenAt: freeze.frozenAt,
            message: freeze.message,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to freeze attendance window", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to freeze attendance window");
    }
  }

  static async getSections(
    userId: string,
    semesterId: string
  ): Promise<{ id: string; name: string }[]> {
    const facultyId =
      await FacultyAttendanceWindowService.getFacultyIdByUserId(userId);

    const assignments = await db.courseAssignment.findMany({
      where: {
        facultyId,
        section: { semesterId },
      },
      select: {
        sectionId: true,
        section: { select: { id: true, name: true } },
      },
    });

    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const a of assignments) {
      if (!seen.has(a.sectionId)) {
        seen.add(a.sectionId);
        result.push({ id: a.section.id, name: a.section.name });
      }
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  static async bulkFreeze(
    userId: string,
    payload: FacultyBulkFreeze,
    username?: string | null,
    displayUsername?: string | null
  ): Promise<BaseResponse<BulkFreezeResult>> {
    try {
      await FacultyAttendanceWindowService.validateScope(
        payload.academicTermId,
        payload.semesterId
      );

      const facultyId =
        await FacultyAttendanceWindowService.getFacultyIdByUserId(userId);

      const rows = await FreezeService.getFacultyWindows(
        facultyId,
        payload.semesterId
      );

      const targetRows = payload.sectionId
        ? rows.filter((r) => r.sectionId === payload.sectionId)
        : rows;

      const result: BulkFreezeResult = {
        processed: 0,
        skipped: 0,
        failed: 0,
        skippedAssignments: [],
        failedAssignments: [],
      };

      for (const row of targetRows) {
        if (row.freeze.displayState !== "OPEN") {
          result.skipped++;
          if (row.freeze.displayState === "FROZEN_BY_FACULTY") {
            result.skippedAssignments.push(
              `${row.courseAssignmentId} (already frozen by faculty)`
            );
          } else if (row.freeze.displayState === "FROZEN_BY_HOD") {
            result.skippedAssignments.push(
              `${row.courseAssignmentId} (HOD frozen)`
            );
          } else {
            result.skippedAssignments.push(
              `${row.courseAssignmentId} (admin locked)`
            );
          }
          continue;
        }

        try {
          await FreezeService.freeze(
            row.courseAssignmentId,
            "faculty",
            username,
            displayUsername
          );
          result.processed++;
        } catch {
          result.failed++;
          result.failedAssignments.push(row.courseAssignmentId);
        }
      }

      return {
        status: "success",
        message: `Processed ${result.processed} windows (${result.skipped} skipped, ${result.failed} failed)`,
        data: result,
      };
    } catch (error) {
      logger.error("Failed to bulk freeze attendance windows", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to bulk freeze attendance windows");
    }
  }
}
