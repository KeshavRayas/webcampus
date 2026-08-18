import { FreezeService } from "@webcampus/api/src/services/faculty/freeze.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type {
  AdminAttendanceWindowFilters,
  AdminAttendanceWindowRow,
  AdminBulkFreeze,
  AdminBulkUnfreeze,
} from "@webcampus/schemas/admin";
import type { BaseResponse } from "@webcampus/types/api";

type ResolvedScope = {
  semesterId: string;
};

export class AttendanceWindowService {
  private static async resolveScope(
    input: AdminAttendanceWindowFilters
  ): Promise<ResolvedScope> {
    const term = await db.academicTerm.findUnique({
      where: { id: input.academicTermId },
      select: { id: true, isCurrent: true },
    });

    if (!term) {
      throw new Error("Academic Term not found");
    }

    if (!term.isCurrent) {
      throw new Error("Academic Term is not current");
    }

    const semester = await db.semester.findUnique({
      where: { id: input.semesterId },
      select: {
        id: true,
        academicTermId: true,
      },
    });

    if (!semester) {
      throw new Error("Semester not found");
    }

    if (semester.academicTermId !== input.academicTermId) {
      throw new Error("Semester does not belong to the selected academic term");
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

    return {
      semesterId: semester.id,
    };
  }

  private static mapWindowRow(
    row: Awaited<ReturnType<typeof FreezeService.getDepartmentWindows>>[number],
    hodInfo?: { hodName: string | null; hodUsername: string | null }
  ): AdminAttendanceWindowRow {
    return {
      courseAssignmentId: row.courseAssignmentId,
      electiveBatchFacultyId: row.electiveBatchFacultyId,
      isElective: row.isElective,
      courseCode: row.courseCode,
      courseName: row.courseName,
      department: row.department,
      hodName: hodInfo?.hodName ?? null,
      hodUsername: hodInfo?.hodUsername ?? null,
      facultyName: row.facultyName,
      semester: row.semester,
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
    filters: AdminAttendanceWindowFilters
  ): Promise<BaseResponse<AdminAttendanceWindowRow[]>> {
    try {
      await AttendanceWindowService.resolveScope(filters);

      const rows = await FreezeService.getDepartmentWindows(
        filters.departmentId,
        filters.semesterId
      );

      const departmentNames = [...new Set(rows.map((r) => r.department))];
      const departments = await db.department.findMany({
        where: { name: { in: departmentNames } },
        select: {
          name: true,
          hods: {
            select: {
              user: { select: { name: true, username: true } },
            },
            take: 1,
          },
        },
      });
      const hodMap = new Map(
        departments.map((d) => [
          d.name,
          {
            hodName: d.hods[0]?.user?.name ?? null,
            hodUsername: d.hods[0]?.user?.username ?? null,
          },
        ])
      );

      return {
        status: "success",
        message: "Attendance windows fetched successfully",
        data: rows.map((row) =>
          AttendanceWindowService.mapWindowRow(row, hodMap.get(row.department))
        ),
      };
    } catch (error) {
      logger.error("Failed to fetch attendance windows", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to fetch attendance windows");
    }
  }

  static async bulkFreeze(
    payload: AdminBulkFreeze,
    username?: string | null,
    displayUsername?: string | null
  ): Promise<BaseResponse<{ updated: number }>> {
    try {
      await AttendanceWindowService.resolveScope(payload);

      const updated = await FreezeService.bulkFreeze(
        payload.departmentId,
        payload.semesterId,
        payload.targets,
        username,
        displayUsername
      );

      return {
        status: "success",
        message: "Attendance windows frozen successfully",
        data: { updated },
      };
    } catch (error) {
      logger.error("Failed to freeze attendance windows", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to freeze attendance windows");
    }
  }

  static async bulkUnfreeze(
    payload: AdminBulkUnfreeze
  ): Promise<BaseResponse<{ updated: number }>> {
    try {
      await AttendanceWindowService.resolveScope(payload);

      const updated = await FreezeService.bulkUnfreeze(
        payload.departmentId,
        payload.semesterId,
        payload.targets
      );

      return {
        status: "success",
        message: "Attendance windows unfrozen successfully",
        data: { updated },
      };
    } catch (error) {
      logger.error("Failed to unfreeze attendance windows", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to unfreeze attendance windows");
    }
  }

  static async freezeAssignment(
    input: {
      courseAssignmentId?: string | null;
      electiveBatchFacultyId?: string | null;
    },
    username?: string | null,
    displayUsername?: string | null
  ): Promise<BaseResponse<AdminAttendanceWindowRow>> {
    try {
      const freeze = await FreezeService.freeze(
        input,
        "admin",
        username,
        displayUsername
      );

      if (input.electiveBatchFacultyId) {
        const electiveAssignment = await db.electiveBatchFaculty.findUnique({
          where: { id: input.electiveBatchFacultyId },
          include: {
            course: {
              select: {
                code: true,
                name: true,
                department: { select: { id: true, name: true } },
              },
            },
            faculty: { select: { shortName: true } },
            electiveBatch: { select: { name: true } },
          },
        });

        if (!electiveAssignment) {
          throw new Error("Elective batch faculty assignment not found");
        }

        const hod = await db.hod.findFirst({
          where: {
            departmentName: electiveAssignment.course.department?.name ?? "",
          },
          select: {
            user: { select: { name: true, username: true } },
          },
        });

        return {
          status: "success",
          message: "Attendance window locked",
          data: {
            courseAssignmentId: null,
            electiveBatchFacultyId: electiveAssignment.id,
            isElective: true,
            courseCode: electiveAssignment.course.code,
            courseName: electiveAssignment.course.name,
            department: electiveAssignment.course.department?.name ?? "",
            hodName: hod?.user?.name ?? null,
            hodUsername: hod?.user?.username ?? null,
            facultyName: electiveAssignment.faculty.shortName,
            semester: electiveAssignment.semester,
            sectionName: electiveAssignment.electiveBatch.name,
            batchName: null,
            assignmentType: "THEORY",
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
      }

      const courseAssignmentId = input.courseAssignmentId ?? "";
      const assignment = await db.courseAssignment.findUnique({
        where: { id: courseAssignmentId },
        include: {
          course: { select: { code: true, name: true } },
          faculty: { select: { shortName: true } },
          department: { select: { id: true, name: true } },
          section: { select: { name: true } },
          batch: { select: { name: true } },
        },
      });

      if (!assignment) {
        throw new Error("Course assignment not found");
      }

      const hod = await db.hod.findFirst({
        where: { departmentName: assignment.department.name },
        select: {
          user: { select: { name: true, username: true } },
        },
      });

      return {
        status: "success",
        message: "Attendance window locked",
        data: {
          courseAssignmentId: assignment.id,
          electiveBatchFacultyId: null,
          isElective: false,
          courseCode: assignment.course.code,
          courseName: assignment.course.name,
          department: assignment.department.name,
          hodName: hod?.user?.name ?? null,
          hodUsername: hod?.user?.username ?? null,
          facultyName: assignment.faculty.shortName,
          semester: assignment.semester,
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
      logger.error("Failed to lock attendance window", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to lock attendance window");
    }
  }

  static async unfreezeAssignment(input: {
    courseAssignmentId?: string | null;
    electiveBatchFacultyId?: string | null;
  }): Promise<BaseResponse<AdminAttendanceWindowRow>> {
    try {
      const freeze = await FreezeService.unfreeze(input, "admin");

      if (input.electiveBatchFacultyId) {
        const electiveAssignment = await db.electiveBatchFaculty.findUnique({
          where: { id: input.electiveBatchFacultyId },
          include: {
            course: {
              select: {
                code: true,
                name: true,
                department: { select: { id: true, name: true } },
              },
            },
            faculty: { select: { shortName: true } },
            electiveBatch: { select: { name: true } },
          },
        });

        if (!electiveAssignment) {
          throw new Error("Elective batch faculty assignment not found");
        }

        const hod = await db.hod.findFirst({
          where: {
            departmentName: electiveAssignment.course.department?.name ?? "",
          },
          select: {
            user: { select: { name: true, username: true } },
          },
        });

        return {
          status: "success",
          message: "Attendance window reopened",
          data: {
            courseAssignmentId: null,
            electiveBatchFacultyId: electiveAssignment.id,
            isElective: true,
            courseCode: electiveAssignment.course.code,
            courseName: electiveAssignment.course.name,
            department: electiveAssignment.course.department?.name ?? "",
            hodName: hod?.user?.name ?? null,
            hodUsername: hod?.user?.username ?? null,
            facultyName: electiveAssignment.faculty.shortName,
            semester: electiveAssignment.semester,
            sectionName: electiveAssignment.electiveBatch.name,
            batchName: null,
            assignmentType: "THEORY",
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
      }

      const courseAssignmentId = input.courseAssignmentId ?? "";
      const assignment = await db.courseAssignment.findUnique({
        where: { id: courseAssignmentId },
        include: {
          course: { select: { code: true, name: true } },
          faculty: { select: { shortName: true } },
          department: { select: { id: true, name: true } },
          section: { select: { name: true } },
          batch: { select: { name: true } },
        },
      });

      if (!assignment) {
        throw new Error("Course assignment not found");
      }

      const hod = await db.hod.findFirst({
        where: { departmentName: assignment.department.name },
        select: {
          user: { select: { name: true, username: true } },
        },
      });

      return {
        status: "success",
        message: "Attendance window reopened",
        data: {
          courseAssignmentId: assignment.id,
          electiveBatchFacultyId: null,
          isElective: false,
          courseCode: assignment.course.code,
          courseName: assignment.course.name,
          department: assignment.department.name,
          hodName: hod?.user?.name ?? null,
          hodUsername: hod?.user?.username ?? null,
          facultyName: assignment.faculty.shortName,
          semester: assignment.semester,
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
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to reopen attendance window");
    }
  }
}
