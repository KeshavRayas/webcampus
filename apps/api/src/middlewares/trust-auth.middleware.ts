import { TrustAuthService } from "@webcampus/api/src/services/trust/trust-auth.service";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { logger } from "@webcampus/common/logger";
import type { TrustUser } from "@webcampus/schemas/trust";
import type { NextFunction, Request, Response } from "express";

export const TRUST_TOKEN_COOKIE = "trust_token";

function parseCookies(
  cookieHeader: string | undefined
): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

function extractToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token) {
      return token;
    }
  }

  const cookieToken = parseCookies(req.headers.cookie)[TRUST_TOKEN_COOKIE];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * RBAC middleware for the isolated Trust authentication pipeline.
 *
 * Verifies the Trust JWT (from the `Authorization` header or the `trust_token`
 * cookie), ensures the token subject still maps to a `trust` role user in the
 * database, and attaches the verified identity to the request context.
 */
export const trustAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return sendResponse({
        res,
        status: "error",
        statusCode: 401,
        message: "Unauthorized: Trust token missing",
        error: "Unauthorized",
      });
    }

    const payload = TrustAuthService.verifyToken(token);
    if (!payload) {
      return sendResponse({
        res,
        status: "error",
        statusCode: 401,
        message: "Unauthorized: Invalid or expired Trust token",
        error: "Unauthorized",
      });
    }

    const trustUser: TrustUser | null = await TrustAuthService.getTrustUser(
      payload.sub
    );

    if (!trustUser) {
      return sendResponse({
        res,
        status: "error",
        statusCode: 401,
        message: "Unauthorized: Trust user not found",
        error: "Unauthorized",
      });
    }

    req.requestContext = {
      userId: trustUser.id,
      role: "trust",
    };
    res.locals.trustUser = trustUser;

    next();
  } catch (error) {
    logger.error("Trust authorization error", { error });
    return sendResponse({
      res,
      status: "error",
      statusCode: 500,
      message: "Internal server error during Trust authorization",
      error: "Internal server error",
    });
  }
};
