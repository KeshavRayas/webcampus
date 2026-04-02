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
};

export class CoeService {
  static async create(
    request: CreateUserType & {
      headers: IncomingHttpHeaders;
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
      if (user.status === "error") {
        throw new Error(user.message);
      }

      if (!user.data?.id) {
        throw new Error("Failed to create COE user");
      }

      const coe = await db.coe.create({
        data: {
          user: {
            connect: {
              id: user.data.id,
            },
          },
        },
      });

      const response: BaseResponse<Coe> = {
        status: "success",
        message: "COE created successfully",
        data: coe,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("COE already exists for this user");
        }
      }
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      logger.error("Failed to create COE", error);
      throw new Error("Failed to create COE");
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
      }));

      const response = {
        status: "success" as const,
        message: "COEs fetched successfully",
        data: formatted,
      };

      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Failed to get COEs", error);
      throw new Error("Failed to get COEs");
    }
  }

  static async delete(coeId: string): Promise<BaseResponse<null>> {
    try {
      const coe = await db.coe.findUnique({
        where: { id: coeId },
        select: { userId: true },
      });

      if (!coe) {
        throw new Error("COE not found");
      }

      await db.coe.delete({
        where: { id: coeId },
      });

      await db.user.deleteMany({
        where: { id: coe.userId },
      });

      const response: BaseResponse<null> = {
        status: "success",
        message: "COE deleted successfully",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to delete COE", error);
      throw new Error("Failed to delete COE");
    }
  }
}
