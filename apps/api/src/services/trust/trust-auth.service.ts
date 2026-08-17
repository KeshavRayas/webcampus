import { createHmac, timingSafeEqual } from "crypto";
import type { IncomingHttpHeaders } from "http";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type {
  TrustAuthResponse,
  TrustLoginInput,
  TrustUser,
} from "@webcampus/schemas/trust";

const TRUST_ROLE = "trust" as const;
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

type TrustTokenPayload = {
  sub: string;
  role: typeof TRUST_ROLE;
  iat: number;
  exp: number;
};

/**
 * Isolated JWT authentication service for Trust users.
 *
 * Trust users are stored in the unified `User` table with `role = "trust"`.
 * This service:
 *  - verifies credentials against the database through Better Auth's credential
 *    pipeline (email or username),
 *  - issues a dedicated HMAC-signed JWT scoped to the `trust` role,
 *  - and verifies that JWT for subsequent RBAC-guarded requests.
 */
export class TrustAuthService {
  private static base64UrlEncode(input: string | Buffer): string {
    return Buffer.from(input).toString("base64url");
  }

  private static base64UrlDecode(input: string): string {
    return Buffer.from(input, "base64url").toString("utf-8");
  }

  private static signSegments(segments: string): string {
    return createHmac("sha256", backendEnv().BETTER_AUTH_SECRET)
      .update(segments)
      .digest("base64url");
  }

  static signToken(userId: string): string {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload: TrustTokenPayload = {
      sub: userId,
      role: TRUST_ROLE,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    };

    const headerSegment = this.base64UrlEncode(JSON.stringify(header));
    const payloadSegment = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.signSegments(`${headerSegment}.${payloadSegment}`);

    return `${headerSegment}.${payloadSegment}.${signature}`;
  }

  static verifyToken(token: string): TrustTokenPayload | null {
    const segments = token.split(".");
    if (segments.length !== 3) {
      return null;
    }

    const [headerSegment, payloadSegment, signature] = segments;
    if (!headerSegment || !payloadSegment || !signature) {
      return null;
    }

    const expectedSignature = this.signSegments(
      `${headerSegment}.${payloadSegment}`
    );
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(
        this.base64UrlDecode(payloadSegment)
      ) as TrustTokenPayload;

      if (payload.role !== TRUST_ROLE) {
        return null;
      }

      if (typeof payload.sub !== "string" || !payload.sub) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp !== "number" || payload.exp < now) {
        return null;
      }

      return payload;
    } catch (error) {
      logger.warn("Failed to decode trust token payload", error);
      return null;
    }
  }

  private static toTrustUser(user: {
    id: string;
    name: string;
    email: string;
    username: string | null;
    image: string | null;
    role: string | null;
  }): TrustUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      role: TRUST_ROLE,
    };
  }

  static async getTrustUser(userId: string): Promise<TrustUser | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        image: true,
        role: true,
      },
    });

    if (!user || user.role !== TRUST_ROLE) {
      return null;
    }

    return this.toTrustUser(user);
  }

  /**
   * Verifies Trust credentials against the database and issues a JWT.
   *
   * The identifier may be either the Trust user's email or username. Password
   * validation is delegated to Better Auth's credential pipeline so hashing,
   * verification, and rate limiting behave identically to the rest of the app.
   */
  static async login(
    input: TrustLoginInput,
    headers: IncomingHttpHeaders
  ): Promise<TrustAuthResponse> {
    const normalizedIdentifier = input.identifier.trim().toLowerCase();

    const userRecord = await db.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedIdentifier, mode: "insensitive" } },
          { username: { equals: normalizedIdentifier, mode: "insensitive" } },
        ],
      },
      select: { id: true, role: true, email: true },
    });

    if (!userRecord || userRecord.role !== TRUST_ROLE) {
      throw new Error("Invalid email or password");
    }

    let result: { user: { id: string; role?: string | null } };
    try {
      result = await auth.api.signInEmail({
        body: {
          email: userRecord.email,
          password: input.password,
        },
        headers: fromNodeHeaders(headers),
      });
    } catch (error) {
      logger.warn("Trust credential verification failed", error);
      throw new Error("Invalid email or password");
    }

    if (result.user.role !== TRUST_ROLE) {
      throw new Error("Invalid email or password");
    }

    const trustUser = await this.getTrustUser(result.user.id);
    if (!trustUser) {
      throw new Error("Invalid email or password");
    }

    return {
      token: this.signToken(trustUser.id),
      user: trustUser,
    };
  }
}
