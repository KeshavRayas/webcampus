import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { CreateUserType, UpdateAdminUserType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

type TrustUserRecord = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  image: string | null;
  role: string | null;
  createdAt: Date;
};

export class AdminTrustService {
  private static normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private static async uploadPhoto(
    photoFile: Express.Multer.File,
    name: string
  ): Promise<string> {
    const { generateFileName, uploadToS3, sanitizeForS3 } = await import(
      "@webcampus/api/src/utils/s3"
    );

    const prefix = `trust_${sanitizeForS3(name)}_`;
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
          role: "trust",
        },
        headers,
      });

      const user = await userService.create();
      if (user.status === "error" || !user.data?.id) {
        throw new Error(user.message || "Failed to create Trust user");
      }

      createdUserId = user.data.id;

      if (photoFile) {
        uploadedImageUrl = await this.uploadPhoto(photoFile, data.name);

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
        message: "Trust user created successfully",
        data: user.data,
      };
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up uploaded trust photo", {
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
          logger.warn("Failed to clean up auth user after trust failure", {
            createdUserId,
            cleanupError,
          });
        }
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Trust user already exists for this user");
        }
      }

      throw error instanceof Error
        ? error
        : new Error("Failed to create Trust user");
    }
  }

  static async update(
    id: string,
    data: UpdateAdminUserType,
    headers: IncomingHttpHeaders,
    photoFile?: Express.Multer.File
  ): Promise<BaseResponse<TrustUserRecord>> {
    let uploadedImageUrl: string | null = null;

    try {
      const existingUser = await db.user.findUnique({
        where: { id },
        select: { id: true, role: true, image: true, name: true },
      });

      if (!existingUser || existingUser.role !== "trust") {
        throw new Error("Trust user not found");
      }

      if (photoFile) {
        uploadedImageUrl = await this.uploadPhoto(
          photoFile,
          data.name ?? existingUser.name
        );
      }

      if (data.password) {
        await auth.api.setUserPassword({
          headers: fromNodeHeaders(headers),
          body: { userId: id, newPassword: data.password },
        });
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
          logger.warn("Failed to delete previous trust user photo", {
            previousImageUrl: existingUser.image,
            cleanupError,
          });
        }
      }

      return {
        status: "success",
        message: "Trust user updated successfully",
        data: updatedUser as TrustUserRecord,
      };
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up new trust photo", {
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
        : new Error("Failed to update Trust user");
    }
  }

  static async getAll(): Promise<BaseResponse<TrustUserRecord[]>> {
    try {
      const users = await db.user.findMany({
        where: { role: "trust" },
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
        message: "Trust users fetched successfully",
        data: users as TrustUserRecord[],
      };
    } catch (error) {
      logger.error("Failed to fetch Trust users", error);
      throw new Error("Failed to fetch Trust users");
    }
  }

  static async delete(id: string): Promise<BaseResponse<null>> {
    try {
      const user = await db.user.findUnique({
        where: { id },
        select: { id: true, role: true, image: true },
      });

      if (!user) {
        throw new Error("Trust user not found");
      }
      if (user.role !== "trust") {
        throw new Error("Cannot delete non-trust user via this endpoint");
      }

      if (user.image) {
        const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
        await deleteFromS3(user.image);
      }

      await db.user.delete({ where: { id } });

      return {
        status: "success",
        message: "Trust user deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Failed to delete Trust user", error);
      throw error instanceof Error
        ? error
        : new Error("Failed to delete Trust user");
    }
  }
}
