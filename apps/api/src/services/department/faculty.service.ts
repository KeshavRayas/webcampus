import { IncomingHttpHeaders } from "http";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  DepartmentFacultyQueryType,
  DepartmentFacultyResponseType,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

export class DepartmentFacultyService {
  static async getAll(
    headers: IncomingHttpHeaders,
    query: DepartmentFacultyQueryType
  ): Promise<BaseResponse<DepartmentFacultyResponseType[]>> {
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
          type: true,
        },
      });

      if (!department) {
        throw new Error("Department not found for this user");
      }

      const facultyRecords = await db.faculty.findMany({
        where: {
          ...(department.type !== "BASIC_SCIENCES"
            ? { departmentId: department.id }
            : {}),
          designation: query.designation,
          department: query.department
            ? {
                name: {
                  contains: query.department,
                  mode: "insensitive",
                },
              }
            : undefined,
          user: {
            name: query.name
              ? {
                  contains: query.name,
                  mode: "insensitive",
                }
              : undefined,
            email: query.email
              ? {
                  contains: query.email,
                  mode: "insensitive",
                }
              : undefined,
          },
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              createdAt: true,
            },
          },
          hod: {
            select: {
              id: true,
            },
          },
          department: {
            select: {
              name: true,
            },
          },
        },
      });

      const faculty = facultyRecords
        .map((record) => ({
          id: record.id,
          name: record.user.name,
          email: record.user.email,
          department: record.department.name,
          designation: record.designation,
          isHod: Boolean(record.hod),
          createdAt: record.user.createdAt,
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        status: "success",
        message: "Faculty fetched successfully",
        data: faculty,
      };
    } catch (error) {
      logger.error("Failed to fetch department faculty", error);
      throw error;
    }
  }
}
