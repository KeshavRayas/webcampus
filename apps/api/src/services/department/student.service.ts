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
          type: true,
        },
      });

      if (!department) {
        throw new Error("Department not found for this user");
      }

      const isBasicSciences = department.type === "BASIC_SCIENCES";

      let resolvedSemesterNumber: number | undefined;
      if (typeof query.currentSemester === "number") {
        resolvedSemesterNumber = query.currentSemester;
      } else if (query.semesterId) {
        const semester = await db.semester.findUnique({
          where: {
            id: query.semesterId,
          },
          select: {
            semesterNumber: true,
          },
        });

        resolvedSemesterNumber = semester?.semesterNumber;
      }

      const studentRecords = await db.student.findMany({
        where: {
          ...(isBasicSciences
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
          ...(query.academicTermId || query.programType || query.semesterId
            ? {
                admission: {
                  is: {
                    ...(query.semesterId ? { semesterId: query.semesterId } : {}),
                    semester: {
                      ...(query.academicTermId
                        ? { academicTermId: query.academicTermId }
                        : {}),
                      ...(query.programType
                        ? { programType: query.programType }
                        : {}),
                    },
                  },
                },
              }
            : {}),
          ...(query.usn
            ? {
                usn: {
                  contains: query.usn,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(resolvedSemesterNumber
            ? {
                currentSemester: resolvedSemesterNumber,
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
          ...(query.section
            ? {
                studentSections: {
                  some: {
                    section: {
                      name: {
                        contains: query.section,
                        mode: "insensitive",
                      },
                    },
                    ...(resolvedSemesterNumber
                      ? { semester: resolvedSemesterNumber }
                      : {}),
                    ...(query.academicYear
                      ? {
                          academicYear: {
                            equals: query.academicYear,
                            mode: "insensitive",
                          },
                        }
                      : {}),
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

      const studentIds = studentRecords.map((record) => record.id);
      const sectionAssignments =
        studentIds.length > 0
          ? await db.studentSection.findMany({
              where: {
                studentId: {
                  in: studentIds,
                },
                ...(resolvedSemesterNumber
                  ? { semester: resolvedSemesterNumber }
                  : {}),
                ...(query.academicYear
                  ? {
                      academicYear: {
                        equals: query.academicYear,
                        mode: "insensitive",
                      },
                    }
                  : {}),
                ...(query.section
                  ? {
                      section: {
                        name: {
                          contains: query.section,
                          mode: "insensitive",
                        },
                      },
                    }
                  : {}),
              },
              select: {
                studentId: true,
                semester: true,
                academicYear: true,
                section: {
                  select: {
                    name: true,
                  },
                },
              },
            })
          : [];

      const sectionByStudentId = new Map<string, string>();
      for (const assignment of sectionAssignments) {
        if (!sectionByStudentId.has(assignment.studentId)) {
          sectionByStudentId.set(assignment.studentId, assignment.section.name);
        }
      }

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
          section: sectionByStudentId.get(record.id) ?? null,
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
