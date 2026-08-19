import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "@webcampus/auth/types";
import { frontendEnv } from "@webcampus/common/env";
import { Role } from "@webcampus/types/rbac";
import { normalize } from "@webcampus/ui/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_REDIRECTS,
  getRoleFromPathname,
  isSignInRoute,
} from "./lib/middleware-config";

const TRUST_TOKEN_COOKIE = "trust_token";

async function verifyTrustToken(token: string): Promise<boolean> {
  try {
    const response = await betterFetch<{ status: string }>(
      `${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/trust/auth/me`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data?.status === "success";
  } catch (error) {
    console.error("Trust token verification failed in middleware:", error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = normalize(request.nextUrl.pathname);
  const url = request.nextUrl.clone();
  const roleFromPath = getRoleFromPathname(pathname);
  const isSignInPage = isSignInRoute(pathname);
  const isHomePage = pathname === "/" || pathname === "";
  const isTrustArea = roleFromPath === "trust";

  let session: Session | null = null;

  try {
    const response = await betterFetch<Session>(
      `${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/api/auth/get-session`,
      {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      }
    );
    session = response.data ?? null;
  } catch (error) {
    // If the API is temporarily unavailable, continue as unauthenticated
    // instead of crashing middleware with a runtime error.
    console.error("Session fetch failed in middleware:", error);
  }

  // Only verify the trust token when the request is actually for the trust
  // area (dashboard or login). Otherwise we'd hit /trust/auth/me on every
  // request across the whole app while a trust cookie exists, which shows up
  // as constant polling traffic.
  const trustToken = isTrustArea
    ? request.cookies.get(TRUST_TOKEN_COOKIE)?.value
    : undefined;
  const trustVerified = trustToken ? await verifyTrustToken(trustToken) : false;
  const canAccessTrustArea = trustVerified || session?.user?.role === "trust";

  if (session && isSignInPage) {
    url.pathname = DASHBOARD_REDIRECTS[session.user?.role as Role];
    return NextResponse.redirect(url);
  }

  if (isTrustArea && isSignInPage && trustVerified) {
    url.pathname = "/trust";
    return NextResponse.redirect(url);
  }

  if (!session && !isSignInPage && !isHomePage) {
    if (roleFromPath) {
      if (isTrustArea) {
        if (canAccessTrustArea) {
          return NextResponse.next();
        }
        url.pathname = "/trust/login";
        return NextResponse.redirect(url);
      }
      url.pathname = `/${roleFromPath}/sign-in`;
      return NextResponse.redirect(url);
    }
  }

  if (session && roleFromPath && !isSignInPage) {
    if (isTrustArea) {
      if (!canAccessTrustArea) {
        url.pathname = "/403";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    if (
      roleFromPath === "admission" &&
      !["admission"].includes(session.user?.role as string)
    ) {
      url.pathname = "/403";
      return NextResponse.redirect(url);
    } else if (
      roleFromPath !== "admission" &&
      session.user?.role !== roleFromPath
    ) {
      url.pathname = "/403";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}
