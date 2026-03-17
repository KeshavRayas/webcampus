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

      const admissionRecords = await db.admission.findMany({
        where: {
          branch: {
            equals: department.name,
            mode: "insensitive",
          },
          ...(query.tempUsn
            ? {
                tempUsn: {
                  contains: query.tempUsn,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(query.name
            ? {
                OR: [
                  {
                    firstName: {
                      contains: query.name,
                      mode: "insensitive",
                    },
                  },
                  {
                    lastName: {
                      contains: query.name,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.modeOfAdmission
            ? {
                modeOfAdmission: {
                  contains: query.modeOfAdmission,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(query.gender
            ? {
                gender: {
                  contains: query.gender,
                  mode: "insensitive",
                },
              }
            : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const students: DepartmentStudentResponseType[] = admissionRecords.map(
        (record) => ({
          id: record.id,
          applicationId: record.applicationId,
          tempUsn: record.tempUsn ?? null,
          firstName: record.firstName ?? null,
          lastName: record.lastName ?? null,
          branch: record.branch ?? null,
          status: record.status,
          modeOfAdmission: record.modeOfAdmission,
          gender: record.gender ?? null,
          primaryEmail: record.primaryEmail ?? null,
          createdAt: record.createdAt,
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
