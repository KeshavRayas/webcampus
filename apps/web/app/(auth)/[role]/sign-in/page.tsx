import { AuthSignInView } from "@/modules/auth/sign-in/auth-sign-in-view";
import { roles } from "@webcampus/types/rbac";
import { notFound } from "next/navigation";
import React from "react";
import z from "zod";

const SignInPage = async ({
  params,
}: {
  params: Promise<{ role: string }>;
}) => {
  const roleSchema = z.object({
    role: z.enum([...roles, "admission"] as const),
  });
  const { data, success } = await roleSchema.safeParseAsync(await params);

  if (!success) notFound();

  return <AuthSignInView initialRole={data.role} />;
};

export default SignInPage;
