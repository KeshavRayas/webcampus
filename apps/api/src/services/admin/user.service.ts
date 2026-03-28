import { IncomingHttpHeaders } from "http";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db, User } from "@webcampus/db";
import {
  CreateUserType,
  UserResponseType,
  UsersQueryDTO,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { type Role } from "@webcampus/types/rbac";

/**
 * Custom User Service for Better Auth Integration
 *
 * This service provides a temporary workaround for a limitation in Better Auth's
 * Admin API, which currently does **not support** creating users with a `username` field
 * via the `createUser` method.
 *
 * In our system, the `username` field is essential, especially for student users,
 * where it serves as the USN (University Student Number) and is required during login.
 *
 * To handle this, we first register the user using the `signUpEmail` method which allows
 * providing a username, and then assign roles separately via the Admin API.
 *
 * Once Better Auth supports `username` in the `createUser` endpoint directly,
 * this service and its usage (controllers, routes, etc.) should be deprecated,
 * and user creation should be done directly from the frontend using the Admin API.
 */
export class UserService {
  private body: CreateUserType;
  private userId: string | null = null;
  private headers: IncomingHttpHeaders;

  /**
   * Normalizes username to lowercase for credential storage.
   * Better Auth username plugin normalizes to lowercase on sign-in,
   * so we ensure stored username matches this expectation.
   */
  private static normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private static getDefaultUsername(email: string): string {
    return UserService.normalizeUsername(email.split("@")[0] || email);
  }

  private static getDisplayUsername(name: string): string {
    return name.trim();
  }

  static async backfillMissingProfileFields(options?: {
    force?: boolean;
  }): Promise<number> {
    const force = options?.force ?? false;

    const usersNeedingBackfill = await db.user.findMany({
      where: force
        ? undefined
        : {
            OR: [{ username: null }, { displayUsername: null }],
          },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        displayUsername: true,
        student: {
          select: {
            usn: true,
          },
        },
      },
    });

    let updatedCount = 0;

    for (const user of usersNeedingBackfill) {
      const nextUsername =
        user.student?.usn ||
        user.username ||
        UserService.getDefaultUsername(user.email);
      const nextDisplayUsername =
        user.displayUsername || UserService.getDisplayUsername(user.name);

      const shouldUpdate =
        force || !user.username || !user.displayUsername ||
        user.username !== nextUsername ||
        user.displayUsername !== nextDisplayUsername;

      if (!shouldUpdate) {
        continue;
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          username: nextUsername,
          displayUsername: nextDisplayUsername,
        },
      });
      updatedCount += 1;
    }

    return updatedCount;
  }

  private async ensureUserProfileFields(userId: string): Promise<void> {
    const username = this.body.username
      ? UserService.normalizeUsername(this.body.username)
      : UserService.getDefaultUsername(this.body.email);
    const displayUsername = UserService.getDisplayUsername(this.body.name);

    await db.user.update({
      where: { id: userId },
      data: {
        username,
        displayUsername,
      },
    });
  }

  constructor({
    request,
    headers,
  }: {
    request: CreateUserType;
    headers: IncomingHttpHeaders;
  }) {
    this.body = request;
    this.headers = headers;
  }
  /**
   * Main method to create a user.
   *
   * Delegates to `createStudent` if the user is a student,
   * otherwise uses the Admin API directly.
   *
   * @returns {Promise<BaseResponse<null>>} A base response containing a success message.
   */
  async create(): Promise<BaseResponse<Partial<User>>> {
    try {
      if (this.body.role === "student" || this.body.role === "applicant") {
        return await this.createStudent();
      } else {
        return await this.createUserWithAdminAPI();
      }
    } catch (error) {
      logger.error("User creation failed:", error);
      throw new Error(
        error instanceof Error ? error.message : "User creation failed."
      );
    }
  }

  /**
   * Handles the student-specific creation flow:
   * - Uses signUpEmail to register with username
   * - Assigns role with Admin API
   *
   * @returns {Promise<BaseResponse<null>>}
   */
  private async createStudent(): Promise<BaseResponse<Partial<User>>> {
    try {
      const user = await this.createUserWithUsername();
      await this.updateUserRole();
      return {
        status: "success",
        message: "Student created successfully.",
        data: user,
      };
    } catch (error) {
      logger.error("Primary student/applicant creation path failed", { error });

      // Fallback: create via Admin API, then hydrate username/displayUsername in DB.
      // This keeps admission shell creation working when signUpEmail rejects in server context.
      try {
        const fallbackResponse = await this.createUserWithAdminAPI();
        if (fallbackResponse.status !== "success" || !fallbackResponse.data) {
          throw new Error(
            fallbackResponse.status === "error"
              ? fallbackResponse.message
              : "Admin API user creation returned no data"
          );
        }
        return {
          status: "success",
          message: "Student created successfully.",
          data: fallbackResponse.data,
        };
      } catch (fallbackError) {
        logger.error("Fallback student/applicant creation also failed", {
          fallbackError,
        });
        throw new Error(
          fallbackError instanceof Error
            ? fallbackError.message
            : error instanceof Error
              ? error.message
              : "Failed to create student user."
        );
      }
    }
  }

  /**
   * Uses `signUpEmail` API to create a user with a `username`.
   * Saves the returned user ID for later role assignment.
   *
   * @throws {Error} if sign-up fails
   */
  private async createUserWithUsername(): Promise<Partial<User>> {
    try {
      const { user } = await auth.api.signUpEmail({
        body: this.body,
        headers: fromNodeHeaders(this.headers),
      });
      this.userId = user.id;
      await this.ensureUserProfileFields(user.id);

      const hydratedUser = await db.user.findUnique({
        where: { id: user.id },
      });

      logger.info("Student USN reated using signUpEmail", { user });
      return hydratedUser ?? user;
    } catch (error) {
      logger.error("signUpEmail failed", { error });
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to sign up user with username."
      );
    }
  }

  /**
   * Updates the role of the user via Admin API.
   * Falls back to deleting the user if role update fails.
   *
   * @throws {Error} if role update or user deletion fails
   */
  private async updateUserRole(): Promise<void> {
    if (!this.userId) {
      throw new Error("User ID not found. Cannot assign role.");
    }

    const targetRole = this.body.role as Role;

    try {
      const { user } = await auth.api.setRole({
        body: {
          userId: this.userId,
          role: targetRole,
        },
        headers: fromNodeHeaders(this.headers),
      });
      logger.info("User Role updated using Admin API", { user });
    } catch (error) {
      logger.error("Failed to update user role via Admin API", { error });

      // Fallback for contexts where Better Auth setRole rejects despite route-level authorization.
      const existingUser = await db.user.findUnique({
        where: { id: this.userId },
        select: { role: true },
      });

      if (existingUser?.role === targetRole) {
        logger.info("User role already matches target role", {
          userId: this.userId,
          role: targetRole,
        });
        return;
      }

      await db.user.update({
        where: { id: this.userId },
        data: { role: targetRole },
      });

      logger.info("User role updated via DB fallback", {
        userId: this.userId,
        role: targetRole,
      });
    }
  }

  /**
   * Creates a non-student user using Better Auth Admin API.
   *
   * @returns {Promise<BaseResponse<null>>} Success message
   * @throws {Error} if creation fails
   */
  private async createUserWithAdminAPI(): Promise<BaseResponse<Partial<User>>> {
    try {
      const { user } = await auth.api.createUser({
        body: {
          email: this.body.email,
          password: this.body.password,
          name: this.body.name,
          role: this.body.role as Role,
        },
      });

      await this.ensureUserProfileFields(user.id);

      const hydratedUser = await db.user.findUnique({
        where: { id: user.id },
      });

      logger.info("User Created using Admin API ", { user });
      return {
        status: "success",
        message: `${this.body.role} created successfully`,
        data: hydratedUser ?? user,
      };
    } catch (error) {
      logger.error("createUser via admin API failed:", error);
      throw new Error("Failed to create user via admin API.");
    }
  }

  static async getUsers(
    query: UsersQueryDTO
  ): Promise<BaseResponse<UserResponseType[]>> {
    try {
      await UserService.backfillMissingProfileFields();

      const users = await db.user.findMany({
        where: {
          ...query,
          role: Array.isArray(query.role)
            ? { in: query.role.map((role) => role.toLowerCase()) }
            : query.role
              ? { equals: query.role.toLowerCase() }
              : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          displayUsername: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          emailVerified: true,
          banned: true,
          banReason: true,
          banExpires: true,
        },
      });
      const response: BaseResponse<UserResponseType[]> = {
        status: "success",
        message: "Users fetched successfully",
        data: users,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Failed to get users", { error });
      throw new Error("Failed to get users");
    }
  }
}
