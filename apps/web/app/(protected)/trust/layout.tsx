import { betterFetch } from "@better-fetch/fetch";
import { frontendEnv } from "@webcampus/common/env";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

const TRUST_TOKEN_COOKIE = "trust_token";

export default async function TrustLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TRUST_TOKEN_COOKIE)?.value;

  if (!token) {
    redirect("/trust/login");
  }

  try {
    const response = await betterFetch<{ status: string }>(
      `${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/trust/auth/me`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );
    if (response.data?.status !== "success") {
      redirect("/trust/login");
    }
  } catch (error) {
    console.error("Trust layout guard verification failed:", error);
    redirect("/trust/login");
  }

  return <>{children}</>;
}
