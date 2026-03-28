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

export async function middleware(request: NextRequest) {
  const pathname = normalize(request.nextUrl.pathname);
  const url = request.nextUrl.clone();
  const roleFromPath = getRoleFromPathname(pathname);
  const isSignInPage = isSignInRoute(pathname);
  const isHomePage = pathname === "/" || pathname === "";

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

  if (session && isSignInPage) {
    url.pathname = DASHBOARD_REDIRECTS[session.user?.role as Role];
    return NextResponse.redirect(url);
  }

  if (!session && !isSignInPage && !isHomePage) {
    if (roleFromPath) {
      url.pathname = `/${roleFromPath}/sign-in`;
      return NextResponse.redirect(url);
    }
  }

  if (session && roleFromPath) {
    if (
      roleFromPath === "admission" &&
      !["admission_admin", "admission_reviewer"].includes(
        session.user?.role as string
      )
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
