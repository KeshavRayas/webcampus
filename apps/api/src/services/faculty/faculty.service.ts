import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  BaseFacultyType,
  CreateFacultyExperienceType,
  CreateFacultyPublicationType,
  CreateFacultyQualificationType,
  UpdateFacultyExperienceType,
  UpdateFacultyProfileType,
  UpdateFacultyPublicationType,
  UpdateFacultyQualificationType,
  UpdateFacultyType,
} from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";

const ADMIN_ONLY_UPDATE_KEYS = ["staffType", "dob"] as const;

const monthDiff = (startDate: Date, endDate: Date) => {
  const years = endDate.getFullYear() - startDate.getFullYear();
  const months = endDate.getMonth() - startDate.getMonth();
  return years * 12 + months;
};

const toDurationLabel = (startDate: Date, endDate?: Date | null) => {
  const end = endDate ?? new Date();
  const totalMonths = Math.max(monthDiff(startDate, end), 0);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) {
    return `${months} month${months === 1 ? "" : "s"}`;
  }

  if (months === 0) {
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
};

export class Faculty {
  static async create(data: BaseFacultyType): Promise<BaseResponse<unknown>> {
    try {
      const faculty = await db.faculty.create({
        data: {
          userId: data.userId,
          departmentId: data.departmentId,
          shortName: data.shortName,
          designation: data.designation,
          employeeId: data.employeeId,
          staffType: data.staffType,
          dob: data.dob,
          dateOfJoining: data.dateOfJoining,
        },
      });

      const response: BaseResponse<unknown> = {
        status: "success",
        message: "Faculty created successfully",
        data: faculty,
      };
      logger.info({ response });
      return response;
    } catch (error) {
      logger.error("Error creating faculty:", { error });
      throw new Error("Failed to create faculty");
    }
  }

  static async getAll(): Promise<BaseResponse<unknown[]>> {
    try {
      const faculties = await db.faculty.findMany();
      const response: BaseResponse<unknown[]> = {
        status: "success",
        message: "Faculties retrieved successfully",
        data: faculties,
      };
      logger.info({ response });
      return response;
    } catch (error) {
      logger.error("Error retrieving faculties:", { error });
      throw new Error("Failed to retrieve faculties");
    }
  }

  static async getById(id: string): Promise<BaseResponse<unknown>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { id },
      });

      if (!faculty) {
        throw new Error("Faculty not found");
      }

      const response: BaseResponse<unknown> = {
        status: "success",
        message: "Faculty retrieved successfully",
        data: faculty,
      };
      logger.info({ response });
      return response;
    } catch (error) {
      logger.error("Error retrieving faculty:", { error });
      throw new Error("Failed to retrieve faculty");
    }
  }

  static async update(
    id: string,
    data: UpdateFacultyType
  ): Promise<BaseResponse<unknown>> {
    try {
      const faculty = await db.faculty.update({
        where: { id },
        data: {
          ...(data.departmentId && { departmentId: data.departmentId }),
          ...(data.designation && { designation: data.designation }),
          ...(data.shortName && { shortName: data.shortName }),
          ...(data.employeeId && { employeeId: data.employeeId }),
          ...(data.staffType && { staffType: data.staffType }),
          ...(data.dob && { dob: data.dob }),
          ...(data.dateOfJoining && { dateOfJoining: data.dateOfJoining }),
        },
      });

      const response: BaseResponse<unknown> = {
        status: "success",
        message: "Faculty updated successfully",
        data: faculty,
      };
      logger.info({ response });
      return response;
    } catch (error) {
      logger.error("Error updating faculty:", { error });
      throw new Error("Failed to update faculty");
    }
  }

  static async delete(id: string): Promise<BaseResponse<void>> {
    try {
      await db.faculty.delete({
        where: { id },
      });

      const response: BaseResponse<void> = {
        status: "success",
        message: "Faculty deleted successfully",
        data: null,
      };
      logger.info({ response });
      return response;
    } catch (error) {
      logger.error("Error deleting faculty:", { error });
      throw new Error("Failed to delete faculty");
    }
  }

  static async getProfileByUserId(userId: string): Promise<BaseResponse<unknown>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              username: true,
              displayUsername: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          qualifications: {
            orderBy: {
              yearPassed: "desc",
            },
          },
          publications: {
            orderBy: {
              publishedDate: "desc",
            },
          },
          experiences: {
            orderBy: {
              startDate: "desc",
            },
          },
        },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const data = {
        ...faculty,
        experiences: faculty.experiences.map((experience) => ({
          ...experience,
          durationLabel: toDurationLabel(experience.startDate, experience.endDate),
        })),
      };

      return {
        status: "success",
        message: "Faculty profile fetched successfully",
        data,
      };
    } catch (error) {
      logger.error("Error retrieving faculty profile", error);
      throw error;
    }
  }

  static async updateProfileByUserId(
    userId: string,
    data: UpdateFacultyProfileType,
    isAdmin: boolean
  ): Promise<BaseResponse<unknown>> {
    try {
      const faculty = await db.faculty.findUnique({ where: { userId } });
      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      if (!isAdmin) {
        const forbiddenKey = ADMIN_ONLY_UPDATE_KEYS.find((key) => key in data);
        if (forbiddenKey) {
          throw new Error(`Field ${forbiddenKey} can only be edited by admin`);
        }
      }

      const nextData: Record<string, unknown> = {
        ...data,
        profileUpdatedAt: new Date(),
      };

      if (data.sameAsPresentAddress) {
        nextData.permanentAddressLine = data.presentAddressLine ?? faculty.presentAddressLine;
        nextData.permanentCity = data.presentCity ?? faculty.presentCity;
        nextData.permanentState = data.presentState ?? faculty.presentState;
        nextData.permanentPincode = data.presentPincode ?? faculty.presentPincode;
      }

      const updated = await db.faculty.update({
        where: { userId },
        data: nextData,
      });

      return {
        status: "success",
        message: "Faculty profile updated successfully",
        data: updated,
      };
    } catch (error) {
      logger.error("Error updating faculty profile", error);
      throw error;
    }
  }

  static async createQualificationByUserId(
    userId: string,
    data: CreateFacultyQualificationType
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const created = await db.facultyQualification.create({
      data: {
        facultyId: faculty.id,
        ...data,
      },
    });

    return {
      status: "success",
      message: "Qualification added successfully",
      data: created,
    };
  }

  static async updateQualificationByUserId(
    userId: string,
    qualificationId: string,
    data: UpdateFacultyQualificationType
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const ownedRecord = await db.facultyQualification.findFirst({
      where: {
        id: qualificationId,
        facultyId: faculty.id,
      },
      select: { id: true },
    });
    if (!ownedRecord) {
      throw new Error("Qualification not found");
    }

    const updated = await db.facultyQualification.update({
      where: {
        id: qualificationId,
      },
      data,
    });

    return {
      status: "success",
      message: "Qualification updated successfully",
      data: updated,
    };
  }

  static async deleteQualificationByUserId(
    userId: string,
    qualificationId: string
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const ownedRecord = await db.facultyQualification.findFirst({
      where: {
        id: qualificationId,
        facultyId: faculty.id,
      },
      select: { id: true },
    });
    if (!ownedRecord) {
      throw new Error("Qualification not found");
    }

    const deleted = await db.facultyQualification.delete({
      where: {
        id: qualificationId,
      },
    });

    return {
      status: "success",
      message: "Qualification deleted successfully",
      data: deleted,
    };
  }

  static async createPublicationByUserId(
    userId: string,
    data: CreateFacultyPublicationType
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const created = await db.facultyPublication.create({
      data: {
        facultyId: faculty.id,
        ...data,
      },
    });

    return {
      status: "success",
      message: "Publication added successfully",
      data: created,
    };
  }

  static async updatePublicationByUserId(
    userId: string,
    publicationId: string,
    data: UpdateFacultyPublicationType
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const ownedRecord = await db.facultyPublication.findFirst({
      where: {
        id: publicationId,
        facultyId: faculty.id,
      },
      select: { id: true },
    });
    if (!ownedRecord) {
      throw new Error("Publication not found");
    }

    const updated = await db.facultyPublication.update({
      where: {
        id: publicationId,
      },
      data,
    });

    return {
      status: "success",
      message: "Publication updated successfully",
      data: updated,
    };
  }

  static async deletePublicationByUserId(
    userId: string,
    publicationId: string
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const ownedRecord = await db.facultyPublication.findFirst({
      where: {
        id: publicationId,
        facultyId: faculty.id,
      },
      select: { id: true },
    });
    if (!ownedRecord) {
      throw new Error("Publication not found");
    }

    const deleted = await db.facultyPublication.delete({
      where: {
        id: publicationId,
      },
    });

    return {
      status: "success",
      message: "Publication deleted successfully",
      data: deleted,
    };
  }

  static async createExperienceByUserId(
    userId: string,
    data: CreateFacultyExperienceType
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const created = await db.facultyExperience.create({
      data: {
        facultyId: faculty.id,
        ...data,
      },
    });

    return {
      status: "success",
      message: "Experience added successfully",
      data: created,
    };
  }

  static async updateExperienceByUserId(
    userId: string,
    experienceId: string,
    data: UpdateFacultyExperienceType
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const ownedRecord = await db.facultyExperience.findFirst({
      where: {
        id: experienceId,
        facultyId: faculty.id,
      },
      select: { id: true },
    });
    if (!ownedRecord) {
      throw new Error("Experience not found");
    }

    const updated = await db.facultyExperience.update({
      where: {
        id: experienceId,
      },
      data,
    });

    return {
      status: "success",
      message: "Experience updated successfully",
      data: updated,
    };
  }

  static async deleteExperienceByUserId(
    userId: string,
    experienceId: string
  ): Promise<BaseResponse<unknown>> {
    const faculty = await db.faculty.findUnique({ where: { userId } });
    if (!faculty) {
      throw new Error("Faculty profile not found");
    }

    const ownedRecord = await db.facultyExperience.findFirst({
      where: {
        id: experienceId,
        facultyId: faculty.id,
      },
      select: { id: true },
    });
    if (!ownedRecord) {
      throw new Error("Experience not found");
    }

    const deleted = await db.facultyExperience.delete({
      where: {
        id: experienceId,
      },
    });

    return {
      status: "success",
      message: "Experience deleted successfully",
      data: deleted,
    };
  }
}
