import { IncomingHttpHeaders } from "http";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  DepartmentStudentQueryType,
  DepartmentStudentResponseType,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

export class DepartmentStudentService {
  static async getAll(
    headers: IncomingHttpHeaders,
    query: DepartmentStudentQueryType
  ): Promise<BaseResponse<DepartmentStudentResponseType[]>> {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(headers),
      });

      const userId = session?.user?.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      const department = await db.department.findFirst({
        where: {
          userId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!department) {
        throw new Error("Department not found for this user");
      }

      const normalizedDepartmentName = department.name.trim().toLowerCase();
      const isFirstYearDepartmentAdmin =
        normalizedDepartmentName === "first year";

      const studentRecords = await db.student.findMany({
        where: {
          ...(isFirstYearDepartmentAdmin
            ? {
                currentSemester: {
                  in: [1, 2],
                },
              }
            : {
                departmentName: {
                  equals: department.name,
                  mode: "insensitive",
                },
              }),
          ...(query.usn
            ? {
                usn: {
                  contains: query.usn,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(query.currentSemester
            ? {
                currentSemester: query.currentSemester,
              }
            : {}),
          ...(query.academicYear
            ? {
                academicYear: {
                  contains: query.academicYear,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(query.departmentName
            ? {
                departmentName: {
                  equals: query.departmentName,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(query.name
            ? {
                user: {
                  name: {
                    contains: query.name,
                    mode: "insensitive",
                  },
                },
              }
            : {}),
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          usn: "asc",
        },
      });

      const students: DepartmentStudentResponseType[] = studentRecords.map(
        (record) => ({
          id: record.id,
          userId: record.userId,
          usn: record.usn,
          name: record.user.name ?? null,
          email: record.user.email ?? null,
          departmentName: record.departmentName,
          currentSemester: record.currentSemester,
          academicYear: record.academicYear,
        })
      );

      return {
        status: "success",
        message: "Students fetched successfully",
        data: students,
      };
    } catch (error) {
      logger.error("Failed to fetch department students", error);
      throw error;
    }
  }
}
