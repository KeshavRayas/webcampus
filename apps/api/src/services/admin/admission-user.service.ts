import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  CreateAdmissionUserType,
  UpdateAdmissionUserType,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

const ADMISSION_ROLES = ["admission_admin"] as const;

type AdmissionUserRecord = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  image: string | null;
  role: string | null;
  createdAt: Date;
};

export class AdminAdmissionUserService {
  private static normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private static async uploadPhoto(
    photoFile: Express.Multer.File,
    prefix: string
  ): Promise<string> {
    const { generateFileName, uploadToS3 } = await import(
      "@webcampus/api/src/utils/s3"
    );

    const photoFileName = generateFileName(photoFile.originalname, prefix);
    const uploadResult = await uploadToS3(
      photoFile.buffer,
      photoFileName,
      photoFile.mimetype
    );

    if (!uploadResult.success || !uploadResult.url) {
      throw new Error("Failed to upload profile photo");
    }

    return uploadResult.url;
  }

  private static async deletePhoto(url: string): Promise<void> {
    const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
    await deleteFromS3(url);
  }

  private static async syncRole(
    userId: string,
    role: CreateAdmissionUserType["role"],
    headers: IncomingHttpHeaders
  ): Promise<void> {
    try {
      await auth.api.setRole({
        body: {
          userId,
          role,
        },
        headers: fromNodeHeaders(headers),
      });
    } catch (error) {
      logger.warn("Falling back to DB role update for admission user", {
        userId,
        role,
        error,
      });

      await db.user.update({
        where: { id: userId },
        data: {
          role,
        },
      });
    }
  }

  static async create(
    data: CreateAdmissionUserType,
    headers: IncomingHttpHeaders,
    photoFile?: Express.Multer.File
  ): Promise<BaseResponse<unknown>> {
    let createdUserId: string | null = null;
    let uploadedImageUrl: string | null = null;

    try {
      const userService = new UserService({
        request: {
          ...data,
          username: data.username,
        },
        headers,
      });

      const user = await userService.create();
      if (user.status === "error" || !user.data?.id) {
        throw new Error(user.message || "Failed to create admission user");
      }

      createdUserId = user.data.id;

      if (photoFile) {
        uploadedImageUrl = await this.uploadPhoto(
          photoFile,
          "admission_user_photo_"
        );

        await db.user.update({
          where: { id: createdUserId },
          data: {
            image: uploadedImageUrl,
          },
        });
      }

      return {
        status: "success",
        message: "Admission user created successfully",
        data: user.data,
      };
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up uploaded admission user photo", {
            uploadedImageUrl,
            cleanupError,
          });
        }
      }

      if (createdUserId) {
        try {
          await auth.api.removeUser({
            headers: fromNodeHeaders(headers),
            body: {
              userId: createdUserId,
            },
          });
        } catch (cleanupError) {
          logger.warn("Failed to clean up admission auth user after failure", {
            createdUserId,
            cleanupError,
          });
        }
      }

      logger.error("Failed to create admission user", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create admission user"
      );
    }
  }

  static async update(
    id: string,
    data: UpdateAdmissionUserType,
    // headers: IncomingHttpHeaders
    photoFile?: Express.Multer.File
  ): Promise<BaseResponse<AdmissionUserRecord>> {
    let uploadedImageUrl: string | null = null;
    try {
      const existingUser = await db.user.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          image: true,
        },
      });

      if (!existingUser || existingUser.role !== "admission_admin") {
        throw new Error("Admission user not found");
      }

      // Safely handle S3 File Uploads
      if (photoFile) {
        uploadedImageUrl = await this.uploadPhoto(
          photoFile,
          "admission_user_photo_"
        );
      }

      // Safely Sync Roles with external Auth provider
      // if (data.role && existingUser.role !== data.role) {
      //   await this.syncRole(id, data.role, headers);
      // }

      // Only updates fields that are explicitly provided, preventing undefined crashes
      const updateData: Prisma.UserUpdateInput = {};

      if (data.name) {
        updateData.name = data.name.trim();
        updateData.displayUsername = data.name.trim();
      }
      if (data.email) {
        updateData.email = data.email.trim();
      }
      if (data.username) {
        updateData.username = this.normalizeUsername(data.username);
      }
      // if (data.role) {
      //   updateData.role = data.role;
      // }
      if (uploadedImageUrl) {
        updateData.image = uploadedImageUrl;
      }

      // 4. Execute the safe database update
      const updatedUser = await db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          displayUsername: true,
          image: true,
          role: true,
          createdAt: true,
        },
      });

      // 5. Cleanup the old S3 photo if a new one was uploaded
      if (uploadedImageUrl && existingUser.image) {
        try {
          await this.deletePhoto(existingUser.image);
        } catch (cleanupError) {
          logger.warn("Failed to delete previous admission user photo", {
            previousImageUrl: existingUser.image,
            cleanupError,
          });
        }
      }

      return {
        status: "success",
        message: "Admission user updated successfully",
        data: updatedUser,
      };
    } catch (error) {
      // Revert the S3 upload if the database update failed
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up new admission user photo", {
            uploadedImageUrl,
            cleanupError,
          });
        }
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Email or username already exists");
      }

      logger.error("Failed to update admission user", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to update admission user"
      );
    }
  }

  static async getAll(): Promise<BaseResponse<unknown>> {
    try {
      await UserService.backfillMissingProfileFields();

      const users = await db.user.findMany({
        where: {
          role: {
            in: [...ADMISSION_ROLES],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          displayUsername: true,
          image: true,
          role: true,
          createdAt: true,
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

  static async delete(id: string): Promise<BaseResponse<unknown>> {
    try {
      const user = await db.user.findUnique({
        where: { id },
        select: { id: true, role: true, image: true }, // grab image to delete it!
      });

      if (!user) {
        throw new Error("User not found");
      }
      if (user.role !== "admission_admin") {
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
