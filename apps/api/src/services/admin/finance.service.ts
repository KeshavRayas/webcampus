import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { CreateUserType, UpdateAdminUserType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

type FinanceUserRecord = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  image: string | null;
  role: string | null;
  createdAt: Date;
};

export class AdminFinanceService {
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

  static async create(
    data: CreateUserType,
    headers: IncomingHttpHeaders,
    photoFile?: Express.Multer.File,
    photo?: string
  ): Promise<BaseResponse<unknown>> {
    let createdUserId: string | null = null;
    let uploadedImageUrl: string | null = null;

    try {
      const userService = new UserService({
        request: {
          ...data,
          role: "finance",
        },
        headers,
      });

      const user = await userService.create();
      if (user.status === "error" || !user.data?.id) {
        throw new Error(user.message || "Failed to create Finance user");
      }

      createdUserId = user.data.id;

      if (photoFile) {
        uploadedImageUrl = await this.uploadPhoto(
          photoFile,
          "finance_user_photo_"
        );

        await db.user.update({
          where: { id: createdUserId },
          data: { image: uploadedImageUrl },
        });
      }

      if (photo) {
        await db.user.update({
          where: { id: createdUserId },
          data: { image: photo },
        });
      }

      return {
        status: "success",
        message: "Finance user created successfully",
        data: user.data,
      };
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up uploaded finance photo", {
            uploadedImageUrl,
            cleanupError,
          });
        }
      }

      if (createdUserId) {
        try {
          await auth.api.removeUser({
            headers: fromNodeHeaders(headers),
            body: { userId: createdUserId },
          });
        } catch (cleanupError) {
          logger.warn("Failed to clean up auth user after finance failure", {
            createdUserId,
            cleanupError,
          });
        }
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Finance user already exists for this user");
        }
      }

      throw error instanceof Error ? error : new Error("Failed to create Finance user");
    }
  }

  static async update(
    id: string,
    data: UpdateAdminUserType,
    photoFile?: Express.Multer.File
  ): Promise<BaseResponse<FinanceUserRecord>> {
    let uploadedImageUrl: string | null = null;

    try {
      const existingUser = await db.user.findUnique({
        where: { id },
        select: { id: true, role: true, image: true },
      });

      if (!existingUser || existingUser.role !== "finance") {
        throw new Error("Finance user not found");
      }

      if (photoFile) {
        uploadedImageUrl = await this.uploadPhoto(
          photoFile,
          "finance_user_photo_"
        );
      }

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
      if (uploadedImageUrl) {
        updateData.image = uploadedImageUrl;
      }

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

      if (uploadedImageUrl && existingUser.image) {
        try {
          await this.deletePhoto(existingUser.image);
        } catch (cleanupError) {
          logger.warn("Failed to delete previous finance user photo", {
            previousImageUrl: existingUser.image,
            cleanupError,
          });
        }
      }

      return {
        status: "success",
        message: "Finance user updated successfully",
        data: updatedUser as FinanceUserRecord,
      };
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up new finance photo", {
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

      throw error instanceof Error
        ? error
        : new Error("Failed to update Finance user");
    }
  }

  static async getAll(): Promise<BaseResponse<FinanceUserRecord[]>> {
    try {
      const users = await db.user.findMany({
        where: { role: "finance" },
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

      return {
        status: "success",
        message: "Finance users fetched successfully",
        data: users as FinanceUserRecord[],
      };
    } catch (error) {
      logger.error("Failed to fetch Finance users", error);
      throw new Error("Failed to fetch Finance users");
    }
  }

  static async delete(id: string): Promise<BaseResponse<null>> {
    try {
      const user = await db.user.findUnique({
        where: { id },
        select: { id: true, role: true, image: true },
      });

      if (!user) {
        throw new Error("Finance user not found");
      }
      if (user.role !== "finance") {
        throw new Error("Cannot delete non-finance user via this endpoint");
      }

      if (user.image) {
        const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
        await deleteFromS3(user.image);
      }

      await db.user.delete({ where: { id } });

      return { status: "success", message: "Finance user deleted successfully", data: null };
    } catch (error) {
      logger.error("Failed to delete Finance user", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to delete Finance user");
    }
  }
}
