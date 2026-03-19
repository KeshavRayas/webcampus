import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  CreateSemesterType,
  SemesterQueryType,
  SemesterResponseType,
} from "@webcampus/schemas/admin";
import { UUIDType } from "@webcampus/schemas/common";
import { BaseResponse } from "@webcampus/types/api";

export class SemesterService {
  private static validateSemesterConstraints(data: CreateSemesterType): void {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (startDate >= endDate) {
      throw new Error("End date must be after start date");
    }

    const isOddSemester = data.semesterNumber % 2 === 1;
    if (data.type === "odd" && !isOddSemester) {
      throw new Error("Odd type allows only 1, 3, 5, or 7");
    }

    if (data.type === "even" && isOddSemester) {
      throw new Error("Even type allows only 2, 4, 6, or 8");
    }
  }

  static async create(
    data: CreateSemesterType
  ): Promise<BaseResponse<SemesterResponseType>> {
    try {
      SemesterService.validateSemesterConstraints(data);

      const name = `${data.type.toUpperCase()} ${data.year}`;
      const currentDate = new Date();
      const isCurrent =
        currentDate >= new Date(data.startDate) &&
        currentDate <= new Date(data.endDate);

      const semester = await db.semester.create({
        data: {
          ...data,
          name,
          isCurrent,
        },
      });
      const response: BaseResponse<SemesterResponseType> = {
        status: "success",
        message: "Semester created successfully",
        data: semester,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error(
            `Semester ${data.type} ${data.year} ${data.semesterNumber} already exists`
          );
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error({ error });
      throw new Error("Failed to create semester");
    }
  }

  static async update(
    id: string,
    data: CreateSemesterType
  ): Promise<BaseResponse<SemesterResponseType>> {
    try {
      SemesterService.validateSemesterConstraints(data);

      const name = `${data.type.toUpperCase()} ${data.year}`;
      const currentDate = new Date();
      const isCurrent =
        currentDate >= new Date(data.startDate) &&
        currentDate <= new Date(data.endDate);

      const semester = await db.semester.update({
        where: { id },
        data: {
          type: data.type,
          year: data.year,
          startDate: data.startDate,
          endDate: data.endDate,
          name,
          isCurrent,
        },
      });
      const response: BaseResponse<SemesterResponseType> = {
        status: "success",
        message: "Semester updated successfully",
        data: semester,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error(
            `Semester ${data.type} ${data.year} ${data.semesterNumber} already exists`
          );
        }
        if (error.code === "P2025") {
          throw new Error("Semester not found");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error({ error });
      throw new Error("Failed to update semester");
    }
  }

  static async getAll(
    query: SemesterQueryType
  ): Promise<BaseResponse<SemesterResponseType[]>> {
    try {
      const semesters = await db.semester.findMany({
        where: {
          ...query,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const currentDate = new Date();
      const semestersWithStatus = semesters.map((semester) => ({
        ...semester,
        isCurrent:
          currentDate >= semester.startDate && currentDate <= semester.endDate,
      }));

      const response: BaseResponse<SemesterResponseType[]> = {
        status: "success",
        message: "Semesters fetched successfully",
        data: semestersWithStatus,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new Error("Semester not found");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error({ error });
      throw new Error("Failed to fetch semesters");
    }
  }

  static async delete({ id }: UUIDType): Promise<BaseResponse<null>> {
    try {
      await db.semester.delete({
        where: { id },
      });
      const response: BaseResponse<null> = {
        status: "success",
        message: "Semester deleted successfully",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new Error("Semester not found");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error({ error });
      throw new Error("Failed to delete semester");
    }
  }
}
