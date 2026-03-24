import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { CreateAdmissionUserType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

export class AdminAdmissionUserService {
  static async create(
    data: CreateAdmissionUserType,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      const userService = new UserService({
        request: {
          ...data,
          username: data.username || "",
        },
        headers,
      });

      const user = await userService.create();
      if (user.status === "error" || !user.data) {
        throw new Error(user.message || "Failed to create admission user");
      }

      return {
        status: "success",
        message: "Admission user created successfully",
        data: user.data,
      };
    } catch (error) {
      logger.error("Failed to create admission user", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create admission user"
      );
    }
  }

  static async getAll(): Promise<BaseResponse<unknown>> {
    try {
      const users = await db.user.findMany({
        where: {
          role: {
            in: ["admission_admin", "admission_reviewer"],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        status: "success",
        message: "Fetched admission users successfully",
        data: users,
      };
    } catch (error) {
      logger.error("Failed to fetch admission users", error);
      throw new Error("Failed to fetch admission users");
    }
  }

  static async delete(id: string): Promise<BaseResponse<unknown>> {
    try {
      const user = await db.user.findUnique({ where: { id } });
      if (!user) {
        throw new Error("User not found");
      }
      if (
        user.role !== "admission_admin" &&
        user.role !== "admission_reviewer"
      ) {
        throw new Error("Cannot delete non-admission user via this endpoint");
      }

      await db.user.delete({ where: { id } });
      return { status: "success", message: "User deleted", data: null };
    } catch (error) {
      logger.error("Failed to delete admission user", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to delete user"
      );
    }
  }
}
