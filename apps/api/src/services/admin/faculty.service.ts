import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { CreateUserType } from "@webcampus/schemas/admin";
import { CreateFacultyType } from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";

export class AdminFacultyService {
  // Utility function to generate "BF" from "Bruno Fernandes"
  static generateShortName(name: string): string {
    return name
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 3); // Max 3 characters just in case of very long names
  }

  static async create(
    request: CreateFacultyType &
      CreateUserType & { headers: IncomingHttpHeaders }
  ): Promise<BaseResponse<unknown>> {
    try {
      // 1. Create the global auth user
      const userService = new UserService({
        request: {
          email: request.email,
          password: request.password,
          name: request.name,
          username: request.username,
          role: "faculty", // Force the role
        },
        headers: request.headers,
      });

      const authUser = await userService.create();

      if (authUser.status === "error" || !authUser.data?.id) {
        throw new Error(authUser.message || "Failed to create auth user");
      }

      // 2. Generate the Short Name automatically
      const shortName = this.generateShortName(request.name);

      // 3. Create the Faculty record linked to the Department
      const faculty = await db.faculty.create({
        data: {
          userId: authUser.data.id,
          departmentId: request.departmentId,
          designation: request.designation,
          shortName: shortName,
        },
        include: {
          user: true,
        },
      });

      const response: BaseResponse<unknown> = {
        status: "success",
        message: "Faculty created successfully",
        data: faculty,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Faculty already exists");
      }
      logger.error("Failed to create faculty", error);
      throw new Error("Failed to create faculty");
    }
  }

  static async getByDepartmentId(
    departmentId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const faculties = await db.faculty.findMany({
        where: { departmentId },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      const response: BaseResponse<unknown> = {
        status: "success",
        message: "Faculty fetched successfully",
        data: faculties,
      };
      return response;
    } catch (error) {
      logger.error("Failed to fetch faculty", error);
      throw error;
    }
  }
}
