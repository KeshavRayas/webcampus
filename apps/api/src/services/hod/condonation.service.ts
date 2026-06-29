import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type {
  HODCondonationCourse,
  HODCondonationFilters,
  HODCondonationStudentRow,
} from "@webcampus/schemas/hod";
import { MAX_CONDONATION, MIN_CONDONATION } from "@webcampus/schemas/hod";
import type { BaseResponse } from "@webcampus/types/api";

export class HODCondonationService {
  private static async resolveHODDepartmentName(
    userId: string
  ): Promise<string> {
    const hod = await db.hod.findUnique({
      where: { userId },
      select: { departmentName: true },
    });
    if (!hod?.departmentName) {
      throw new Error("HOD profile not found or department not assigned");
    }
    return hod.departmentName;
  }

  static async getStudents(
    userId: string,
    filters: HODCondonationFilters
  ): Promise<BaseResponse<HODCondonationStudentRow[]>> {
    try {
      const departmentName = await this.resolveHODDepartmentName(userId);

      const registrations = await db.courseRegistration.findMany({
        where: {
          academicTermId: filters.academicTermId,
          semesterId: filters.semesterId,
          ...(filters.courseId ? { courseId: filters.courseId } : {}),
          course: {
            department: { name: departmentName },
          },
          student: {
            ...(filters.sectionId
              ? {
                  studentSections: {
                    some: { sectionId: filters.sectionId },
                  },
                }
              : {}),
            ...(filters.search
              ? {
                  OR: [
                    {
                      usn: {
                        contains: filters.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      user: {
                        name: {
                          contains: filters.search,
                          mode: "insensitive",
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
        },
        select: {
          studentId: true,
          courseId: true,
        },
      });

      if (registrations.length === 0) {
        return {
          status: "success",
          message: "No eligible students found",
          data: [],
        };
      }

      const attendances = await db.attendance.findMany({
        where: {
          OR: registrations.map((r) => ({
            studentId: r.studentId,
            courseId: r.courseId,
          })),
          percentage: { gte: MIN_CONDONATION, lt: MAX_CONDONATION },
        },
        include: {
          student: {
            include: { user: { select: { name: true } } },
          },
          course: { select: { code: true, name: true } },
        },
        orderBy: [{ percentage: "asc" }, { student: { usn: "asc" } }],
      });

      const rows: HODCondonationStudentRow[] = attendances.map((a) => ({
        attendanceId: a.id,
        studentId: a.studentId,
        usn: a.student.usn,
        name: a.student.user.name,
        courseCode: a.course.code,
        courseName: a.course.name,
        courseId: a.courseId,
        percentage: a.percentage,
        total: a.total,
        present: a.present,
        condonationStatus: a.condonationStatus,
      }));

      return {
        status: "success",
        message: "Eligible students fetched successfully",
        data: rows,
      };
    } catch (error) {
      logger.error("Failed to fetch condonation students", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch condonation students");
    }
  }

  static async getCourses(
    userId: string,
    semesterId?: string
  ): Promise<HODCondonationCourse[]> {
    const departmentName = await this.resolveHODDepartmentName(userId);

    const where: {
      department: { name: string };
      semesterId?: string;
    } = {
      department: { name: departmentName },
    };
    if (semesterId) where.semesterId = semesterId;

    const courses = await db.course.findMany({
      where,
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });

    return courses;
  }

  static async approveCondonation(
    userId: string,
    attendanceId: string
  ): Promise<
    BaseResponse<{
      attendanceId: string;
      condonationStatus: string;
      percentage: number;
    }>
  > {
    try {
      const departmentName = await this.resolveHODDepartmentName(userId);

      const result = await db.$transaction(async (tx) => {
        const attendance = await tx.attendance.findUnique({
          where: { id: attendanceId },
          include: {
            course: {
              include: {
                department: { select: { name: true } },
              },
            },
          },
        });

        if (!attendance) {
          throw new Error("Attendance record not found");
        }

        if (attendance.course.department.name !== departmentName) {
          throw new Error("Student is not in your department");
        }

        if (attendance.condonationStatus === "APPROVED") {
          throw new Error(
            "Attendance has already been approved for condonation"
          );
        }

        if (
          attendance.percentage < MIN_CONDONATION ||
          attendance.percentage >= MAX_CONDONATION
        ) {
          throw new Error("Attendance is not eligible for condonation");
        }

        const updated = await tx.attendance.update({
          where: { id: attendanceId },
          data: {
            condonationStatus: "APPROVED",
            percentage: MAX_CONDONATION,
          },
          select: {
            id: true,
            condonationStatus: true,
            percentage: true,
          },
        });

        if (!updated) {
          throw new Error("Failed to approve condonation");
        }

        return updated;
      });

      return {
        status: "success",
        message: "Condonation approved successfully",
        data: {
          attendanceId: result.id,
          condonationStatus: result.condonationStatus,
          percentage: result.percentage,
        },
      };
    } catch (error) {
      logger.error("Failed to approve condonation", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to approve condonation");
    }
  }
}
