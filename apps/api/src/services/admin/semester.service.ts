import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AcademicTermQueryType,
  AcademicTermResponseType,
  CreateAcademicTermType,
  CreateSemesterConfigType,
  SemesterConfigResponseType,
} from "@webcampus/schemas/admin";
import { UUIDType } from "@webcampus/schemas/common";
import { BaseResponse } from "@webcampus/types/api";

export class SemesterService {
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
      const terms = await db.academicTerm.findMany({
        where: query,
        orderBy: { year: "desc" },
        include: { Semester: true },
      });
      const response: BaseResponse<AcademicTermResponseType[]> = {
        status: "success",
        message: "Academic Terms fetched successfully",
        data: terms,
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
