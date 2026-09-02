// IMPORTANT: Import dayjs to handle date boundaries accurately
import { dayjs } from "@webcampus/common/dayjs";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AcademicTermQueryType,
  AcademicTermResponseType,
  CreateAcademicTermType,
  CreateSemesterConfigType,
  SemesterConfigResponseType,
  SemesterLifecycleStatusType,
  UpdateAcademicTermType,
} from "@webcampus/schemas/admin";
import { UUIDType } from "@webcampus/schemas/common";
import { BaseResponse } from "@webcampus/types/api";
import { ArchiveService } from "./archive.service";

function getTermDisplayName(
  type: "even" | "odd" | "supplementary",
  parity?: "odd" | "even" | null
): string {
  if (type === "supplementary" && parity) {
    return parity === "odd" ? "Odd Supplementary" : "Even Supplementary";
  }
  return type;
}

export class SemesterService {
  private static getSemesterStatus(
    startDate: Date,
    endDate: Date,
    now: Date
  ): SemesterLifecycleStatusType {
    // Force day boundaries so time-of-day doesn't cause premature archiving
    const start = dayjs(startDate).startOf("day");
    const end = dayjs(endDate).endOf("day");
    const today = dayjs(now);

    if (today.isBefore(start)) return "INACTIVE"; // Future
    if (today.isAfter(end)) return "ARCHIVED"; // Past
    return "ACTIVE"; // Current
  }

  private static getTermStatus(
    semesterStatuses: SemesterLifecycleStatusType[]
  ): SemesterLifecycleStatusType {
    // If no semesters are configured yet, the term is INACTIVE
    if (semesterStatuses.length === 0) return "INACTIVE";

    // If ANY semester is active, the whole term stays active
    if (semesterStatuses.includes("ACTIVE")) return "ACTIVE";

    // ONLY if EVERY single semester is archived does the term become archived
    if (semesterStatuses.every((status) => status === "ARCHIVED")) {
      return "ARCHIVED";
    }

    // Catch-all (e.g., term has a mix of INACTIVE/Future and ARCHIVED/Past, but nothing active right now)
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
          `Academic Term ${getTermDisplayName(data.type, data.parity)} ${data.year} already exists`
        );
      }
      logger.error({ error });
      throw new Error("Failed to create academic term");
    }
  }

  static async updateAcademicTerm(
    id: string,
    data: UpdateAcademicTermType
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

        // Apply dayjs boundary check here too to remain consistent
        const today = dayjs(now);
        const hasStartedSemester = existingTerm.Semester.some(
          (semester) =>
            today.isAfter(dayjs(semester.startDate).startOf("day")) ||
            today.isSame(dayjs(semester.startDate).startOf("day"))
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
          `Academic Term ${getTermDisplayName(data.type, data.parity)} ${data.year} already exists`
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
      const { status, isCurrent, ...whereQuery } = query;
      const now = new Date();

      const terms = await db.academicTerm.findMany({
        where: {
          ...whereQuery,
          ...(isCurrent !== undefined
            ? { isCurrent: String(isCurrent) === "true" }
            : {}),
        },
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

      // Auto-archive semesters that have transitioned to ARCHIVED status
      const archivedSemesterIds = termsWithStatus.flatMap((term) =>
        (term.Semester || [])
          .filter((s) => s.status === "ARCHIVED")
          .map((s) => s.id)
      );

      if (archivedSemesterIds.length > 0) {
        // Fire-and-forget: archive in the background without blocking the response
        ArchiveService.autoArchiveSemesters(archivedSemesterIds).catch(
          (err) => {
            logger.error({
              error: err,
              message: "Auto-archive background task failed",
            });
          }
        );
      }

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
    userId: string,
    semesters: CreateSemesterConfigType[]
  ): Promise<BaseResponse<SemesterConfigResponseType[]>> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) {
        throw new Error("Authenticated user not found");
      }

      const term = await db.academicTerm.findUnique({
        where: { id: academicTermId },
        select: { type: true, parity: true, year: true },
      });

      if (!term) {
        throw new Error("Academic Term not found");
      }

      if (term.type === "supplementary" && term.parity) {
        const mismatched = semesters.filter(
          (semester) =>
            semester.semesterNumber % 2 !== (term.parity === "odd" ? 1 : 0)
        );
        if (mismatched.length > 0) {
          throw new Error(
            `${term.parity === "odd" ? "Odd" : "Even"} Supplementary ${term.year} hosts ${
              term.parity === "odd" ? "odd" : "even"
            }-numbered semesters only`
          );
        }
      }

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
              userId,
            },
            create: {
              academicTermId: semester.academicTermId,
              programType: semester.programType,
              semesterNumber: semester.semesterNumber,
              startDate: semester.startDate,
              endDate: semester.endDate,
              userId,
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
      if (error instanceof Error) {
        logger.error({ error: error.message });
        throw error;
      }
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
