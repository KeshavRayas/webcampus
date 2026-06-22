import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { Coe, db, Prisma } from "@webcampus/db";
import { CreateUserType, UpdateAdminUserType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

type CoeUserResponse = {
  id: string;
  userId: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  image: string | null;
  emailVerified: boolean;
  photo: string | null; // Added to match frontend
};

export class CoeService {
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
    request: CreateUserType & {
      headers: IncomingHttpHeaders;
      photoFile?: Express.Multer.File;
    }
  ): Promise<BaseResponse<Coe>> {
    let createdAuthUserId: string | null = null;
    let uploadedImageUrl: string | null = null;

    try {
      const userService = new UserService({
        request: {
          email: request.email,
          password: request.password,
          name: request.name,
          username: request.username,
          role: "coe",
        },
        headers: request.headers,
      });

      const user = await userService.create();
      if (user.status === "error" || !user.data) {
        throw new Error(user.message || "Failed to create user");
      }

      // --- SAVE PHOTO TO USER ---
      if (request.photo) {
        await db.user.update({
          where: { id: user.data.id },
          data: { image: request.photo },
        });
      }

      createdAuthUserId = user.data.id;

      if (request.photoFile) {
        uploadedImageUrl = await this.uploadPhoto(
          request.photoFile,
          "coe_user_photo_"
        );

        await db.user.update({
          where: { id: createdAuthUserId },
          data: {
            image: uploadedImageUrl,
          },
        });
      }

      const coe = await db.coe.create({
        data: {
          user: {
            connect: { id: user.data.id },
          },
        },
      });

      return {
        status: "success",
        message: "COE created successfully",
        data: coe,
      };
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up uploaded COE photo", {
            uploadedImageUrl,
            cleanupError,
          });
        }
      }

      if (createdAuthUserId) {
        try {
          await auth.api.removeUser({
            headers: fromNodeHeaders(request.headers),
            body: {
              userId: createdAuthUserId,
            },
          });
        } catch (cleanupError) {
          logger.warn("Failed to clean up auth user after COE failure", {
            createdAuthUserId,
            cleanupError,
          });
        }
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("COE already exists for this user");
        }
      }
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error instanceof Error ? error : new Error("Failed to create COE");
    }
  }

  static async update(
    coeId: string,
    data: UpdateAdminUserType,
    photoFile?: Express.Multer.File
  ): Promise<BaseResponse<CoeUserResponse>> {
    let uploadedImageUrl: string | null = null;

    try {
      const existingCoe = await db.coe.findUnique({
        where: { id: coeId },
        include: {
          user: {
            select: {
              id: true,
              image: true,
              emailVerified: true,
              role: true,
            },
          },
        },
      });

      if (!existingCoe?.user || existingCoe.user.role !== "coe") {
        throw new Error("COE user not found");
      }

      if (photoFile) {
        uploadedImageUrl = await this.uploadPhoto(photoFile, "coe_user_photo_");
      }

      const updatedUser = await db.user.update({
        where: { id: existingCoe.user.id },
        data: {
          name: data.name.trim(),
          email: data.email.trim(),
          username: this.normalizeUsername(data.username),
          displayUsername: data.name.trim(),
          ...(uploadedImageUrl ? { image: uploadedImageUrl } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          displayUsername: true,
          image: true,
          emailVerified: true,
        },
      });

      if (uploadedImageUrl && existingCoe.user.image) {
        try {
          await this.deletePhoto(existingCoe.user.image);
        } catch (cleanupError) {
          logger.warn("Failed to delete previous COE photo", {
            previousImageUrl: existingCoe.user.image,
            cleanupError,
          });
        }
      }

      return {
        status: "success",
        message: "COE updated successfully",
        data: {
          id: existingCoe.id,
          userId: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          username: updatedUser.username,
          displayUsername: updatedUser.displayUsername,
          image: updatedUser.image,
          emailVerified: updatedUser.emailVerified,
        },
      };
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await this.deletePhoto(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up new COE photo", {
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

      if (error instanceof Error) {
        throw new Error(error.message);
      }
      logger.error("Failed to update COE", error);
      throw new Error("Failed to update COE");
    }
  }

  static async getCoes(): Promise<BaseResponse<CoeUserResponse[]>> {
    try {
      await UserService.backfillMissingProfileFields();

      const coes = await db.coe.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true,
              emailVerified: true,
              username: true,
              displayUsername: true,
              image: true,
            },
          },
        },
      });

      const formatted = coes.map((coe) => ({
        id: coe.id,
        userId: coe.userId,
        name: coe.user.name,
        email: coe.user.email,
        username: coe.user.username,
        displayUsername: coe.user.displayUsername,
        image: coe.user.image,
        emailVerified: coe.user.emailVerified,
        photo: coe.user.image, // Map image to photo
      }));

      return {
        status: "success",
        message: "COEs fetched successfully",
        data: formatted,
      };
    } catch (error) {
      logger.error("Failed to get COEs", error);
      throw new Error("Failed to get COEs");
    }
  }

  // --- NEW: UPDATE METHOD ---
  static async update(
    coeId: string,
    data: Partial<CreateUserType> & { photo?: string }
  ): Promise<BaseResponse<null>> {
    try {
      const coe = await db.coe.findUnique({
        where: { id: coeId },
        include: { user: true },
      });

      if (!coe) throw new Error("COE user not found");

      // Cleanup old photo from S3 if a new one is uploaded
      if (data.photo && coe.user.image) {
        const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
        await deleteFromS3(coe.user.image);
      }

      // Update User details (Name, Username, Image)
      await db.user.update({
        where: { id: coe.userId },
        data: {
          name: data.name,
          username: data.username,
          ...(data.photo && { image: data.photo }),
        },
      });

      return {
        status: "success",
        message: "COE user updated successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Failed to update COE", error);
      throw error instanceof Error ? error : new Error("Failed to update COE");
    }
  }

  static async delete(coeId: string): Promise<BaseResponse<null>> {
    try {
      const coe = await db.coe.findUnique({
        where: { id: coeId },
        include: { user: { select: { image: true } } },
      });

      if (!coe) throw new Error("COE not found");

      // --- CLEANUP S3 ON DELETE ---
      if (coe.user.image) {
        const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
        await deleteFromS3(coe.user.image);
      }

      // Delete COE record first (child) then User (parent)
      await db.coe.delete({ where: { id: coeId } });
      await db.user.delete({ where: { id: coe.userId } });

      return {
        status: "success",
        message: "COE deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Failed to delete COE", error);
      throw error instanceof Error ? error : new Error("Failed to delete COE");
    }
  }
}
