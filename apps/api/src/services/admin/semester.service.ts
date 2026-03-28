import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AcademicTermQueryType,
  AcademicTermResponseType,
  CreateAcademicTermType,
  CreateSemesterConfigType,
  SemesterLifecycleStatusType,
  SemesterConfigResponseType,
} from "@webcampus/schemas/admin";
import { UUIDType } from "@webcampus/schemas/common";
import { BaseResponse } from "@webcampus/types/api";

export class SemesterService {
  private static getSemesterStatus(
    startDate: Date,
    endDate: Date,
    now: Date
  ): SemesterLifecycleStatusType {
    if (startDate <= now && endDate >= now) return "ACTIVE";
    if (endDate < now) return "ARCHIVED";
    return "INACTIVE";
  }

  private static getTermStatus(
    semesterStatuses: SemesterLifecycleStatusType[]
  ): SemesterLifecycleStatusType {
    if (semesterStatuses.includes("ACTIVE")) return "ACTIVE";
    if (
      semesterStatuses.length > 0 &&
      semesterStatuses.every((status) => status === "ARCHIVED")
    ) {
      return "ARCHIVED";
    }
    return "INACTIVE";
  }

  static async createAcademicTerm(
    data: CreateAcademicTermType
  ): Promise<BaseResponse<AcademicTermResponseType>> {
    try {
      const term = await db.academicTerm.create({
        data,
      });
      const response: BaseResponse<AcademicTermResponseType> = {
        status: "success",
        message: "Academic Term created successfully",
        data: term,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          `Academic Term ${data.type} ${data.year} already exists`
        );
      }
      logger.error({ error });
      throw new Error("Failed to create academic term");
    }
  }

  static async updateAcademicTerm(
    id: string,
    data: CreateAcademicTermType
  ): Promise<BaseResponse<AcademicTermResponseType>> {
    try {
      if (data.isCurrent === false) {
        const now = new Date();
        const existingTerm = await db.academicTerm.findUnique({
          where: { id },
          select: {
            Semester: {
              select: {
                startDate: true,
              },
            },
          },
        });

        if (!existingTerm) {
          throw new Error("Academic Term not found");
        }

        const hasStartedSemester = existingTerm.Semester.some(
          (semester) => semester.startDate <= now
        );

        if (hasStartedSemester) {
          throw new Error(
            "Academic Term cannot be set inactive after a semester has started"
          );
        }
      }

      const term = await db.academicTerm.update({
        where: { id },
        data,
      });
      const response: BaseResponse<AcademicTermResponseType> = {
        status: "success",
        message: "Academic Term updated successfully",
        data: term,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          `Academic Term ${data.type} ${data.year} already exists`
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new Error("Academic Term not found");
      }
      logger.error({ error });
      throw new Error("Failed to update academic term");
    }
  }

  static async getAllAcademicTerms(
    query: AcademicTermQueryType
  ): Promise<BaseResponse<AcademicTermResponseType[]>> {
    try {
      const { status, ...whereQuery } = query;
      const now = new Date();

      const terms = await db.academicTerm.findMany({
        where: whereQuery,
        orderBy: { year: "desc" },
        include: { Semester: true },
      });

      const termsWithStatus = terms
        .map((term) => {
          const semestersWithStatus = term.Semester.map((semester) => {
            const semesterStatus = SemesterService.getSemesterStatus(
              semester.startDate,
              semester.endDate,
              now
            );

            return {
              ...semester,
              status: semesterStatus,
            };
          });

          const termStatus = SemesterService.getTermStatus(
            semestersWithStatus.map((semester) => semester.status)
          );

          return {
            ...term,
            isCurrent: termStatus === "ACTIVE",
            status: termStatus,
            Semester: semestersWithStatus,
          };
        })
        .filter((term) => (status ? term.status === status : true));

      const response: BaseResponse<AcademicTermResponseType[]> = {
        status: "success",
        message: "Academic Terms fetched successfully",
        data: termsWithStatus,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error({ error });
      throw new Error("Failed to fetch academic terms");
    }
  }

  static async deleteAcademicTerm({
    id,
  }: UUIDType): Promise<BaseResponse<null>> {
    try {
      await db.academicTerm.delete({
        where: { id },
      });
      const response: BaseResponse<null> = {
        status: "success",
        message: "Academic Term deleted successfully",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new Error("Academic Term not found");
      }
      logger.error({ error });
      throw new Error("Failed to delete academic term");
    }
  }

  static async bulkUpsertSemesters(
    academicTermId: string,
    semesters: CreateSemesterConfigType[]
  ): Promise<BaseResponse<SemesterConfigResponseType[]>> {
    try {
      const upsertedSemesters = await db.$transaction(
        semesters.map((semester) => {
          return db.semester.upsert({
            where: {
              academicTermId_programType_semesterNumber: {
                academicTermId: semester.academicTermId,
                programType: semester.programType,
                semesterNumber: semester.semesterNumber,
              },
            },
            update: {
              startDate: semester.startDate,
              endDate: semester.endDate,
              userId: semester.userId,
            },
            create: {
              academicTermId: semester.academicTermId,
              programType: semester.programType,
              semesterNumber: semester.semesterNumber,
              startDate: semester.startDate,
              endDate: semester.endDate,
              userId: semester.userId,
            },
          });
        })
      );

      const response: BaseResponse<SemesterConfigResponseType[]> = {
        status: "success",
        message: "Semesters upserted successfully",
        data: upsertedSemesters as unknown as SemesterConfigResponseType[],
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error({ error });
      throw new Error("Failed to bulk upsert semesters");
    }
  }

  static async getSemestersByTerm(
    academicTermId: string
  ): Promise<BaseResponse<SemesterConfigResponseType[]>> {
    try {
      const semesters = await db.semester.findMany({
        where: { academicTermId },
        orderBy: [{ programType: "asc" }, { semesterNumber: "asc" }],
      });
      const response: BaseResponse<SemesterConfigResponseType[]> = {
        status: "success",
        message: "Semesters fetched successfully",
        data: semesters as unknown as SemesterConfigResponseType[],
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error({ error });
      throw new Error("Failed to fetch semesters");
    }
  }
}
