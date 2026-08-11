import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

export class HODDepartmentService {
  static async getDepartmentInfo(
    userId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await db.hod.findUnique({
        where: { userId },
        select: {
          department: { select: { id: true, name: true, type: true } },
        },
      });

      if (!hod?.department) {
        throw new Error("HOD profile not found or department not assigned");
      }

      return {
        status: "success",
        message: "HOD department fetched",
        data: {
          departmentId: hod.department.id,
          departmentName: hod.department.name,
          departmentType: hod.department.type,
        },
      };
    } catch (error) {
      logger.error("Error in HODDepartmentService.getDepartmentInfo", error);
      throw error;
    }
  }
}
