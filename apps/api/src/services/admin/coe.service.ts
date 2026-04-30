import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { logger } from "@webcampus/common/logger";
import { Coe, db, Prisma } from "@webcampus/db";
import { CreateUserType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

type CoeUserResponse = {
  id: string;
  userId: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  emailVerified: boolean;
  photo: string | null; // Added to match frontend
};

export class CoeService {
  static async create(
    request: CreateUserType & {
      headers: IncomingHttpHeaders;
      photo?: string; // Caught from controller
    }
  ): Promise<BaseResponse<Coe>> {
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("COE already exists for this user");
      }
      throw error instanceof Error ? error : new Error("Failed to create COE");
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
              image: true, // Select the photo
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
