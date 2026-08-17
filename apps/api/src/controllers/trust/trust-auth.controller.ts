import { TRUST_TOKEN_COOKIE } from "@webcampus/api/src/middlewares/trust-auth.middleware";
import { TrustAuthService } from "@webcampus/api/src/services/trust/trust-auth.service";
import { ERRORS } from "@webcampus/backend-utils/errors";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import type { TrustLoginInput } from "@webcampus/schemas/trust";
import type { Request, Response } from "express";

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export class TrustAuthController {
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const input = req.body as TrustLoginInput;
      const response = await TrustAuthService.login(input, req.headers);

      res.cookie(TRUST_TOKEN_COOKIE, response.token, {
        httpOnly: true,
        secure: backendEnv().NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_MS,
        path: "/",
      });

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Signed in successfully",
        data: response,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const isInvalidCredentials = err.message
        .toLowerCase()
        .includes("invalid");
      logger.warn("Trust login failed", err);
      sendResponse({
        res,
        status: "error",
        statusCode: isInvalidCredentials ? 401 : 500,
        message: err.message || ERRORS.INTERNAL_SERVER_ERROR,
        error: err,
      });
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    try {
      const trustUser = res.locals.trustUser;
      if (!trustUser) {
        sendResponse({
          res,
          status: "error",
          statusCode: 401,
          message: "Unauthorized",
          error: "Unauthorized",
        });
        return;
      }

      sendResponse({
        res,
        status: "success",
        statusCode: 200,
        message: "Trust user fetched successfully",
        data: trustUser,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to fetch trust session", err);
      sendResponse({
        res,
        status: "error",
        statusCode: 500,
        message: err.message || ERRORS.INTERNAL_SERVER_ERROR,
        error: err,
      });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie(TRUST_TOKEN_COOKIE, {
      httpOnly: true,
      secure: backendEnv().NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    sendResponse({
      res,
      status: "success",
      statusCode: 200,
      message: "Signed out successfully",
      data: null,
    });
  }
}
