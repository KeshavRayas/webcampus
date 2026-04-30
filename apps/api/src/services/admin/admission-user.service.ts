import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { CreateAdmissionUserType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

export class AdminAdmissionUserService {
  static async create(
    // We add `photo?: string` here to catch the S3 URL passed from the controller
    data: CreateAdmissionUserType & { photo?: string },
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

      // --- NEW: Save the photo to the database if one was uploaded ---
      if (data.photo && user.data.id) {
        await db.user.update({
          where: { id: user.data.id },
          data: { image: data.photo }, // Maps frontend "photo" to database "image"
        });
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
      await UserService.backfillMissingProfileFields();

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
          displayUsername: true,
          role: true,
          createdAt: true,
          image: true, // Make sure the frontend can receive the image!
        },
        orderBy: { createdAt: "desc" },
      });

      // Map the database 'image' back to 'photo' so the frontend table can read it
      const formattedUsers = users.map((user) => ({
        ...user,
        photo: user.image,
      }));

      return {
        status: "success",
        message: "Fetched admission users successfully",
        data: formattedUsers,
      };
    } catch (error) {
      logger.error("Failed to fetch admission users", error);
      throw new Error("Failed to fetch admission users");
    }
  }

  // --- NEW UPDATE METHOD ---
  static async update(
    id: string,
    data: Partial<CreateAdmissionUserType> & { photo?: string }
  ): Promise<BaseResponse<unknown>> {
    try {
      // 1. Find the existing user to get their current image
      const existingUser = await db.user.findUnique({
        where: { id },
        select: { id: true, image: true, role: true },
      });

      if (!existingUser) {
        throw new Error("User not found");
      }

      // 2. If a NEW photo was uploaded, and an OLD photo exists, delete the old one from S3!
      if (data.photo && existingUser.image) {
        const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
        await deleteFromS3(existingUser.image);
      }

      // 3. Prepare the update payload
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.username !== undefined) updateData.username = data.username;
      if (data.photo !== undefined) updateData.image = data.photo; // Map photo -> image

      // 4. Save to database
      const updatedUser = await db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          image: true,
        },
      });

      return {
        status: "success",
        message: "User updated successfully",
        data: updatedUser,
      };
    } catch (error) {
      logger.error("Failed to update admission user", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to update user"
      );
    }
  }

  static async delete(id: string): Promise<BaseResponse<unknown>> {
    try {
      const user = await db.user.findUnique({
        where: { id },
        select: { id: true, role: true, image: true }, // grab image to delete it!
      });

      if (!user) {
        throw new Error("User not found");
      }
      if (
        user.role !== "admission_admin" &&
        user.role !== "admission_reviewer"
      ) {
        throw new Error("Cannot delete non-admission user via this endpoint");
      }

      // --- CLEANUP S3 ON DELETE ---
      if (user.image) {
        const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
        await deleteFromS3(user.image);
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
