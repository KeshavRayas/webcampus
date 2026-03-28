import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { CreateUserType } from "@webcampus/schemas/admin";
import {
  CreateDepartmentDTO,
  DepartmentResponseDTO,
  UpdateDepartmentDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

/**
 * Service class for department operations.
 *
 * This class provides methods to create departments and retrieve department information.
 * It handles the creation of department records and their associated users.
 *
 * @remarks
 * This class is responsible for interacting with the database to perform CRUD operations on department data.
 */
export class DepartmentService {
  /**
   * Creates a new department.
   *
   * This method creates a new department record in the database and associates it with a user.
   * It also creates a new user record if the user does not exist.
   *
   * @param request - The request object containing department and user information.
   * @returns A promise that resolves to a BaseResponse object containing the created department information.
   */
  static async create(
    request: CreateDepartmentDTO &
      CreateUserType & {
        headers: IncomingHttpHeaders;
        logoFile: Express.Multer.File;
      }
  ): Promise<BaseResponse<DepartmentResponseDTO>> {
    try {
      const userService = new UserService({
        request: {
          email: request.email,
          password: request.password,
          name: request.name,
          username: request.username,
          role: request.role,
        },
        headers: request.headers,
      });
      const user = await userService.create();
      if (user.status === "error") {
        throw new Error(user.message);
      }

      if (!user.data?.id) {
        throw new Error("Failed to create department user");
      }

      const { generateFileName, uploadToS3 } = await import(
        "@webcampus/api/src/utils/s3"
      );
      const logoFileName = generateFileName(
        request.logoFile.originalname,
        "department_logo_"
      );
      const uploadResult = await uploadToS3(
        request.logoFile.buffer,
        logoFileName,
        request.logoFile.mimetype
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error("Failed to upload department logo");
      }

      await db.user.update({
        where: { id: user.data.id },
        data: {
          image: uploadResult.url,
        },
      });

      const department = await db.department.create({
        data: {
          name: request.name,
          code: request.code,
          abbreviation: request.abbreviation,
          type: request.type,
          user: {
            connect: {
              id: user.data.id,
            },
          },
        },
      });
      const response: BaseResponse<DepartmentResponseDTO> = {
        status: "success",
        message: "Department created successfully",
        data: department,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Department already exists");
        }
      }
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      logger.error(`Failed to create department`, error);
      throw new Error("Failed to create department");
    }
  }

  /**
   * Retrieves all departments.
   *
   * This method fetches all department records from the database.
   *
   * @returns A promise that resolves to a BaseResponse object containing an array of department information.
   */
  static async getDepartments(): Promise<
    BaseResponse<
      (DepartmentResponseDTO & {
        email?: string;
        emailVerified?: boolean;
        username?: string | null;
        displayUsername?: string | null;
      })[]
    >
  > {
    try {
      await UserService.backfillMissingProfileFields();

      const departments = await db.department.findMany({
        include: {
          user: {
            select: {
              email: true,
              emailVerified: true,
              username: true,
              displayUsername: true,
            },
          },
        },
      });
      const formattedDepartments: (DepartmentResponseDTO & {
        email?: string;
        emailVerified?: boolean;
        username?: string | null;
        displayUsername?: string | null;
      })[] = departments.map((dept) => {
        const { user, ...departmentData } = dept;
        return {
          ...departmentData,
          email: user?.email,
          emailVerified: user?.emailVerified,
          username: user?.username,
          displayUsername: user?.displayUsername,
        };
      });

      const response = {
        status: "success" as const,
        message: "Departments fetched successfully",
        data: formattedDepartments,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error(`Failed to get departments`, error);
      throw new Error("Failed to get departments");
    }
  }

  // department.service.ts
  static async getDepartmentsPublic(): Promise<
    BaseResponse<
      { id: string; name: string; code: string; abbreviation: string }[]
    >
  > {
    try {
      const departments = await db.department.findMany({
        where: {
          type: {
            not: "BASIC_SCIENCES",
          },
        },
        select: {
          id: true,
          name: true,
          code: true,
          abbreviation: true,
        },
      });
      return {
        status: "success",
        message: "Departments fetched successfully",
        data: departments,
      };
    } catch (error) {
      logger.error("Failed to get departments", error);
      throw new Error("Failed to get departments");
    }
  }

  static async delete(departmentId: string): Promise<BaseResponse<null>> {
    try {
      // Look up the department to get the associated userId
      const department = await db.department.findUnique({
        where: { id: departmentId },
        select: { userId: true },
      });

      if (!department) {
        throw new Error("Department not found");
      }

      // Delete the department first
      await db.department.delete({
        where: { id: departmentId },
      });

      // Then safely delete the associated user (if it still exists)
      await db.user.deleteMany({
        where: { id: department.userId },
      });

      const response: BaseResponse<null> = {
        status: "success",
        message: "Department deleted successfully",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error(`Failed to delete department`, error);
      throw new Error("Failed to delete department");
    }
  }

  static async update(
    id: string,
    data: UpdateDepartmentDTO,
    logoFile?: Express.Multer.File
  ): Promise<BaseResponse<DepartmentResponseDTO>> {
    try {
      const existingDepartment = await db.department.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              image: true,
            },
          },
        },
      });

      if (!existingDepartment) {
        throw new Error("Department not found");
      }

      if (logoFile) {
        const { deleteFromS3, generateFileName, uploadToS3 } = await import(
          "@webcampus/api/src/utils/s3"
        );
        const nextLogoName = generateFileName(
          logoFile.originalname,
          "department_logo_"
        );
        const uploadResult = await uploadToS3(
          logoFile.buffer,
          nextLogoName,
          logoFile.mimetype
        );

        if (!uploadResult.success || !uploadResult.url) {
          throw new Error("Failed to upload department logo");
        }

        if (existingDepartment.user.image) {
          await deleteFromS3(existingDepartment.user.image);
        }

        await db.user.update({
          where: { id: existingDepartment.user.id },
          data: {
            image: uploadResult.url,
          },
        });
      }

        const nextUserData: { username?: string; displayUsername?: string } = {};
        if (data.username !== undefined) {
          nextUserData.username = data.username;
        }
        if (data.displayUsername !== undefined) {
          nextUserData.displayUsername = data.displayUsername;
        }

        if (Object.keys(nextUserData).length > 0) {
          await db.user.update({
            where: { id: existingDepartment.user.id },
            data: nextUserData,
          });
        }

        const departmentData = { ...data } as Record<string, unknown>;
        delete departmentData.username;
        delete departmentData.displayUsername;

      const department = await db.department.update({
        where: { id },
          data: departmentData,
      });

      return {
        status: "success",
        message: "Department updated successfully",
        data: department,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new Error("Department not found");
        }
        if (error.code === "P2002") {
          throw new Error("Department already exists");
        }
      }
      logger.error(`Failed to update department`, error);
      throw new Error("Failed to update department");
    }
  }
}
