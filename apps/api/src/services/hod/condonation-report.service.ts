import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

export class HODCondonationReportService {
  // Corrected helper to match your schema's Hod model
  private static async resolveHODDepartment(userId: string) {
    const hod = await db.hod.findUnique({
      where: { userId },
      select: {
        department: { select: { id: true, type: true } },
      },
    });

    if (!hod?.department) {
      throw new Error("HOD profile not found or department not assigned");
    }

    return {
      departmentId: hod.department.id,
      departmentType: hod.department.type,
    };
  }

  static async getCondonedReport(
    userId: string,
    filters: {
      semesterId: string;
      courseId?: string;
      sectionId?: string;
      cycle?: string;
    }
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await this.resolveHODDepartment(userId);

      const condonations = await db.attendance.findMany({
        where: {
          condonationStatus: "APPROVED",
          course: {
            departmentId: hod.departmentId,
            semesterId: filters.semesterId,
            ...(filters.courseId ? { id: filters.courseId } : {}),
            // Correctly access departmentType via the object returned from helper
            ...(filters.cycle && hod.departmentType === "BASIC_SCIENCES"
              ? { cycle: filters.cycle as Cycle }
              : {}),
          },
          student: {
            studentSections: { some: { sectionId: filters.sectionId } },
          },
        },
        include: {
          student: { include: { user: true } },
          course: { select: { code: true, name: true } },
        },
      });

      return {
        status: "success",
        message: "Condoned students report fetched",
        data: condonations.map((c) => ({
          usn: c.student.usn,
          name: c.student.user.name,
          course: `${c.course.code} - ${c.course.name}`,
          percentage: c.percentage,
        })),
      };
    } catch (error) {
      logger.error(
        "Error in HODCondonationReportService.getCondonedReport",
        error
      );
      throw error;
    }
  }
}
